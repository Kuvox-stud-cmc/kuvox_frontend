export type ImageTemplateFixture = {
  id: string;
  name: string;
  preset: string;
  icon: string;
};

export type ImageMediaFixture = {
  id: string;
  name: string;
  status: string;
  icon: string;
};

export const imageTemplateFixtures: ImageTemplateFixture[] = [
  { id: "square-post", name: "Square post", preset: "1080 x 1080", icon: "crop_square" },
  { id: "story", name: "Story", preset: "1080 x 1920", icon: "crop_portrait" },
  { id: "thumbnail", name: "Thumbnail", preset: "1280 x 720", icon: "smart_display" },
];

export const imageMediaFixtures: ImageMediaFixture[] = [
  { id: "cover", name: "Cover_photo.png", status: "Ready", icon: "image" },
  { id: "cutout", name: "Product_cutout.png", status: "Ready", icon: "category" },
  { id: "texture", name: "Brand_texture.jpg", status: "Ready", icon: "texture" },
];
