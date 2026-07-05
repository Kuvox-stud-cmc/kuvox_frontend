import { API_ROUTES } from "~/const/api-routes";
import type {
  CreateTaskIssueRequest,
  CreateTaskCommentRequest,
  CreateTaskLabelRequest,
  CreateTaskMilestoneRequest,
  TaskCommentDto,
  TaskIssueDetailDto,
  TaskIssueDto,
  TaskIssueFilters,
  TaskLabelDto,
  TaskMilestoneDto,
  UpdateTaskCommentRequest,
  UpdateTaskIssueRequest,
  UpdateTaskIssueStatusRequest,
  UpdateTaskLabelRequest,
  UpdateTaskMilestoneRequest,
} from "../api";
import type { RequestLogger } from "../logger.server";
import { BaseApiModule } from "./base.server";
import { apiClient, bearerAuth } from "./api-client.server";

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") {
      search.set(key, String(value));
    }
  }
  const value = search.toString();
  return value ? `?${value}` : "";
}

function filterQuery(filters: TaskIssueFilters): Record<string, string | number | null | undefined> {
  return {
    studioId: filters.studioId,
    kind: filters.kind,
    status: filters.status,
    assigneeId: filters.assigneeId,
    milestoneId: filters.milestoneId,
    labelId: filters.labelId,
    projectId: filters.projectId,
    dueBefore: filters.dueBefore,
  };
}

export class TasksApi extends BaseApiModule {
  listTasks(token: string, studioId: string, filters: TaskIssueFilters = {}, log?: RequestLogger): Promise<TaskIssueDto[]> {
    return this.get<TaskIssueDto[]>(
      token,
      `${API_ROUTES.TASKS}${query({ ...filters, studioId })}`,
      log,
    );
  }

  listAssignedToMe(token: string, filters: TaskIssueFilters = {}, log?: RequestLogger): Promise<TaskIssueDto[]> {
    return this.get<TaskIssueDto[]>(
      token,
      `${API_ROUTES.TASKS}/assigned-to-me${query(filterQuery(filters))}`,
      log,
    );
  }

  createTask(token: string, studioId: string, input: CreateTaskIssueRequest, log?: RequestLogger): Promise<TaskIssueDto> {
    return this.client.post<TaskIssueDto>(
      `${API_ROUTES.TASKS}${query({ studioId })}`,
      input,
      { auth: bearerAuth(token), log },
    );
  }

  updateTask(token: string, id: string, input: UpdateTaskIssueRequest, log?: RequestLogger): Promise<TaskIssueDto> {
    return this.put<UpdateTaskIssueRequest, TaskIssueDto>(token, `${API_ROUTES.TASKS}/${id}`, input, log);
  }

  updateTaskStatus(token: string, id: string, status: UpdateTaskIssueStatusRequest["status"], log?: RequestLogger): Promise<TaskIssueDto> {
    return this.put<UpdateTaskIssueStatusRequest, TaskIssueDto>(token, `${API_ROUTES.TASKS}/${id}/status`, { status }, log);
  }

  getTask(token: string, id: string, log?: RequestLogger): Promise<TaskIssueDetailDto> {
    return this.get<TaskIssueDetailDto>(token, `${API_ROUTES.TASKS}/${id}`, log);
  }

  deleteTask(token: string, id: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `${API_ROUTES.TASKS}/${id}`, log);
  }

  createComment(token: string, id: string, input: CreateTaskCommentRequest, log?: RequestLogger): Promise<TaskCommentDto> {
    return this.client.post<TaskCommentDto>(
      `${API_ROUTES.TASKS}/${id}/comments`,
      input,
      { auth: bearerAuth(token), log },
    );
  }

  updateComment(token: string, id: string, input: UpdateTaskCommentRequest, log?: RequestLogger): Promise<TaskCommentDto> {
    return this.put<UpdateTaskCommentRequest, TaskCommentDto>(token, `${API_ROUTES.TASKS}/comments/${id}`, input, log);
  }

  deleteComment(token: string, id: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `${API_ROUTES.TASKS}/comments/${id}`, log);
  }

  listMilestones(token: string, studioId: string, log?: RequestLogger): Promise<TaskMilestoneDto[]> {
    return this.get<TaskMilestoneDto[]>(token, `${API_ROUTES.TASKS}/milestones${query({ studioId })}`, log);
  }

  createMilestone(
    token: string,
    studioId: string,
    input: CreateTaskMilestoneRequest,
    log?: RequestLogger,
  ): Promise<TaskMilestoneDto> {
    return this.client.post<TaskMilestoneDto>(
      `${API_ROUTES.TASKS}/milestones${query({ studioId })}`,
      input,
      { auth: bearerAuth(token), log },
    );
  }

  updateMilestone(
    token: string,
    id: string,
    input: UpdateTaskMilestoneRequest,
    log?: RequestLogger,
  ): Promise<TaskMilestoneDto> {
    return this.put<typeof input, TaskMilestoneDto>(token, `${API_ROUTES.TASKS}/milestones/${id}`, input, log);
  }

  deleteMilestone(token: string, id: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `${API_ROUTES.TASKS}/milestones/${id}`, log);
  }

  listLabels(token: string, studioId: string, log?: RequestLogger): Promise<TaskLabelDto[]> {
    return this.get<TaskLabelDto[]>(token, `${API_ROUTES.TASKS}/labels${query({ studioId })}`, log);
  }

  createLabel(
    token: string,
    studioId: string,
    input: CreateTaskLabelRequest,
    log?: RequestLogger,
  ): Promise<TaskLabelDto> {
    return this.client.post<TaskLabelDto>(
      `${API_ROUTES.TASKS}/labels${query({ studioId })}`,
      input,
      { auth: bearerAuth(token), log },
    );
  }

  updateLabel(token: string, id: string, input: UpdateTaskLabelRequest, log?: RequestLogger): Promise<TaskLabelDto> {
    return this.put<UpdateTaskLabelRequest, TaskLabelDto>(token, `${API_ROUTES.TASKS}/labels/${id}`, input, log);
  }

  deleteLabel(token: string, id: string, log?: RequestLogger): Promise<void> {
    return this.deleteVoid(token, `${API_ROUTES.TASKS}/labels/${id}`, log);
  }
}

export const tasksApi = new TasksApi(apiClient);

export const listTasks = (t: string, sid: string, f?: TaskIssueFilters, l?: RequestLogger) => tasksApi.listTasks(t, sid, f, l);
export const listAssignedTasks = (t: string, f?: TaskIssueFilters, l?: RequestLogger) => tasksApi.listAssignedToMe(t, f, l);
export const createTask = (t: string, sid: string, i: CreateTaskIssueRequest, l?: RequestLogger) => tasksApi.createTask(t, sid, i, l);
export const updateTask = (t: string, id: string, i: UpdateTaskIssueRequest, l?: RequestLogger) => tasksApi.updateTask(t, id, i, l);
export const updateTaskStatus = (t: string, id: string, s: UpdateTaskIssueStatusRequest["status"], l?: RequestLogger) => tasksApi.updateTaskStatus(t, id, s, l);
export const getTask = (t: string, id: string, l?: RequestLogger) => tasksApi.getTask(t, id, l);
export const deleteTask = (t: string, id: string, l?: RequestLogger) => tasksApi.deleteTask(t, id, l);
export const createTaskComment = (t: string, id: string, i: CreateTaskCommentRequest, l?: RequestLogger) => tasksApi.createComment(t, id, i, l);
export const updateTaskComment = (t: string, id: string, i: UpdateTaskCommentRequest, l?: RequestLogger) => tasksApi.updateComment(t, id, i, l);
export const deleteTaskComment = (t: string, id: string, l?: RequestLogger) => tasksApi.deleteComment(t, id, l);
export const listTaskMilestones = (t: string, sid: string, l?: RequestLogger) => tasksApi.listMilestones(t, sid, l);
export const createTaskMilestone = (t: string, sid: string, i: CreateTaskMilestoneRequest, l?: RequestLogger) => tasksApi.createMilestone(t, sid, i, l);
export const updateTaskMilestone = (t: string, id: string, i: UpdateTaskMilestoneRequest, l?: RequestLogger) => tasksApi.updateMilestone(t, id, i, l);
export const deleteTaskMilestone = (t: string, id: string, l?: RequestLogger) => tasksApi.deleteMilestone(t, id, l);
export const listTaskLabels = (t: string, sid: string, l?: RequestLogger) => tasksApi.listLabels(t, sid, l);
export const createTaskLabel = (t: string, sid: string, i: CreateTaskLabelRequest, l?: RequestLogger) => tasksApi.createLabel(t, sid, i, l);
export const updateTaskLabel = (t: string, id: string, i: UpdateTaskLabelRequest, l?: RequestLogger) => tasksApi.updateLabel(t, id, i, l);
export const deleteTaskLabel = (t: string, id: string, l?: RequestLogger) => tasksApi.deleteLabel(t, id, l);
