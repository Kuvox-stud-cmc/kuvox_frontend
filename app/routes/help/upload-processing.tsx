import type { Route } from "./+types/upload-processing";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Upload & processing · Kuvox" }];
}

export default function UploadProcessing() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Upload & processing</h1>
      <p className="mt-2 text-gray-600">How uploads are analyzed into a scene graph (stub).</p>
    </section>
  );
}
