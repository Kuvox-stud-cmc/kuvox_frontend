import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { EditorIcon } from "../editor-ui";
import type { SessionUser } from "~/lib/session.server";
import type { ImageSaveState } from "~/store/slices/image-editor-slice";

export interface ImageEditorMenuAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  destructive?: boolean;
  badge?: string;
  submenu?: ImageEditorMenuAction[];
  onSelect?: () => void;
}

export type ImageEditorMenuItem = ImageEditorMenuAction | { id: string; type: "separator" };

export interface ImageEditorMenuGroup {
  label: string;
  actions: ImageEditorMenuItem[];
}

export interface ImageEditorHeaderProps {
  projectName: string;
  saveState: ImageSaveState;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  user?: SessionUser | null;
  menuGroups: ImageEditorMenuGroup[];
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onSave: () => void;
}

export function ImageEditorHeader({
  projectName,
  saveState,
  canUndo,
  canRedo,
  canExport,
  user = null,
  menuGroups,
  onUndo,
  onRedo,
  onExport,
  onSave,
}: ImageEditorHeaderProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const saveLabel = saveStateLabel(saveState);

  useEffect(() => {
    if (!openMenu) return undefined;
    const close = () => setOpenMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);

  return (
    <header className="z-[100] flex h-8 shrink-0 items-center justify-between border-b border-[#484555] bg-[#0f0d16] px-2">
      <div className="flex min-w-0 items-center gap-1">
        <div className="mr-2 flex items-center gap-2 border-r border-[#484555] pr-3">
          <img src="/logo.svg" alt="Kuvox" className="h-5 w-auto" />
        </div>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Image editor menus">
          {menuGroups.map((group) => (
            <MenuDropdown
              key={group.label}
              group={group}
              open={openMenu === group.label}
              onOpenChange={(open) => setOpenMenu(open ? group.label : null)}
            />
          ))}
        </nav>
      </div>

      <div className="flex min-w-0 flex-1 justify-center gap-4 text-[#c9c4d8]/60">
        <div className="flex items-center gap-2">
          <HeaderIconButton icon="undo" label="Undo" disabled={!canUndo} onClick={onUndo} />
          <HeaderIconButton icon="redo" label="Redo" disabled={!canRedo} onClick={onRedo} />
          <HeaderIconButton icon="save" label="Save" onClick={onSave} />
        </div>
        <div className="my-auto hidden h-4 w-px bg-[#484555] sm:block" />
        <span className="hidden min-w-0 max-w-[34vw] truncate text-[11px] font-medium uppercase tracking-widest sm:block">
          {projectName || "Portrait_Edit_HighFidelity_Master.pxd"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SaveStatusIndicator label={saveLabel} state={saveState} />
        <button
          type="button"
          disabled
          title="Share is not available in the image workspace yet"
          className="hidden px-3 py-1 text-[#c9c4d8]/35 md:block"
        >
          Share
        </button>
        <button
          type="button"
          disabled={!canExport}
          onClick={onExport}
          className="rounded-sm bg-[#7c5cff] px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-white transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-40"
        >
          Export
        </button>
        <UserAvatar user={user} />
      </div>
    </header>
  );
}

function MenuDropdown({
  group,
  open,
  onOpenChange,
}: {
  group: ImageEditorMenuGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const actionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const actionableItems = group.actions.filter(isMenuAction);
  const enabledActions = actionableItems.filter((action) => !action.disabled);

  const focusAction = (direction: 1 | -1) => {
    const activeIndex = actionRefs.current.findIndex((node) => node === document.activeElement);
    const currentItem = actionableItems[activeIndex];
    const currentEnabledIndex = enabledActions.findIndex((action) => currentItem?.id === action.id);
    if (enabledActions.length === 0) return;
    const nextEnabled = enabledActions[
      (currentEnabledIndex + direction + enabledActions.length) % enabledActions.length
    ];
    const nextIndex = actionableItems.findIndex((action) => action.id === nextEnabled.id);
    actionRefs.current[nextIndex]?.focus();
  };

  const handleButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenChange(true);
      window.requestAnimationFrame(() => {
        const firstEnabledIndex = actionableItems.findIndex((action) => !action.disabled);
        actionRefs.current[firstEnabledIndex]?.focus();
      });
    }
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusAction(1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusAction(-1);
    }
  };

  return (
    <div
      ref={menuRef}
      className="relative"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        onKeyDown={handleButtonKeyDown}
        className={`rounded px-2 py-1 transition-colors hover:bg-[#36333d] ${
          group.label === "Filter" ? "font-semibold text-[#7c5cff]" : ""
        }`}
      >
        {group.label}
      </button>
      {open ? (
        <div
          role="menu"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
          className="absolute left-0 top-full z-[130] mt-1 w-56 rounded border border-[#484555] bg-[#1c1a24] py-1 shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
        >
          {group.actions.map((item) => {
            if (!isMenuAction(item)) {
              return <div key={item.id} className="my-1 h-px bg-[#484555]/70" role="separator" />;
            }

            const actionIndex = actionableItems.findIndex((action) => action.id === item.id);
            return (
              <MenuItemButton
                key={item.id}
                item={item}
                refCallback={(node) => {
                  actionRefs.current[actionIndex] = node;
                }}
                onClose={() => onOpenChange(false)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MenuItemButton({
  item,
  refCallback,
  onClose,
}: {
  item: ImageEditorMenuAction;
  refCallback: (node: HTMLButtonElement | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="group/menuitem relative">
      <button
        ref={refCallback}
        type="button"
        role="menuitem"
        disabled={item.disabled}
        onClick={() => {
          if (item.disabled || item.submenu) return;
          item.onSelect?.();
          onClose();
        }}
        className={`flex h-8 w-full items-center justify-between gap-3 px-3 text-left text-[12px] outline-none hover:bg-[#36333d] focus:bg-[#36333d] disabled:text-[#c9c4d8]/30 ${
          item.destructive ? "text-[#ffb4ab]" : "text-[#e6e0ed]"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {item.checked ? (
              <EditorIcon className="text-[14px] text-[#7c5cff]">check</EditorIcon>
            ) : item.icon ? (
              <EditorIcon className="text-[14px]">{item.icon}</EditorIcon>
            ) : null}
          </span>
          <span className="truncate">{item.label}</span>
          {item.badge ? (
            <span className="rounded border border-[#484555] px-1 text-[9px] uppercase tracking-wider text-[#c9c4d8]/50">
              {item.badge}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {item.shortcut ? (
            <span className="text-[10px] uppercase tracking-wider text-[#c9c4d8]/45">
              {item.shortcut}
            </span>
          ) : null}
          {item.submenu ? <EditorIcon className="text-[14px] text-[#c9c4d8]/55">chevron_right</EditorIcon> : null}
        </span>
      </button>
      {item.submenu ? (
        <div className="invisible absolute left-full top-0 z-[140] ml-1 w-60 rounded border border-[#484555] bg-[#1c1a24] py-1 opacity-0 shadow-[0_18px_60px_rgba(0,0,0,0.45)] group-hover/menuitem:visible group-hover/menuitem:opacity-100 group-focus-within/menuitem:visible group-focus-within/menuitem:opacity-100">
          {item.submenu.map((child) => (
            <MenuItemButton
              key={child.id}
              item={child}
              refCallback={() => undefined}
              onClose={onClose}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function isMenuAction(item: ImageEditorMenuItem): item is ImageEditorMenuAction {
  return !("type" in item);
}

function SaveStatusIndicator({ state, label }: { state: ImageSaveState; label: string }) {
  const color =
    state === "synced" ? "bg-[#44e2cd]" : state === "sync-failed" || state === "server-changed" ? "bg-[#ffb4ab]" : "bg-[#e7b548]";
  return (
    <span className="hidden items-center gap-1 text-[10px] uppercase tracking-wider text-[#c9c4d8]/60 md:flex">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function UserAvatar({ user }: { user: SessionUser | null }) {
  const initials = getInitials(user);
  return (
    <div
      title={user?.displayName ?? user?.email ?? "Account"}
      className="hidden h-6 w-6 shrink-0 place-items-center rounded bg-[#2b2932] text-[10px] font-bold text-[#e6e0ed] ring-1 ring-[#484555] sm:grid"
    >
      {initials}
    </div>
  );
}

function HeaderIconButton({
  icon,
  label,
  disabled = false,
  onClick,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center text-[#c9c4d8] transition-colors hover:text-[#e6e0ed] disabled:pointer-events-none disabled:opacity-25"
    >
      <EditorIcon className="text-[18px]">{icon}</EditorIcon>
    </button>
  );
}

function getInitials(user: SessionUser | null) {
  const source = user?.displayName?.trim() || user?.email?.trim() || "Kuvox";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function saveStateLabel(saveState: ImageSaveState) {
  if (saveState === "syncing") return "Syncing";
  if (saveState === "synced") return "Synced";
  if (saveState === "sync-failed") return "Sync failed";
  if (saveState === "server-changed") return "Server changed";
  return "Saved locally";
}
