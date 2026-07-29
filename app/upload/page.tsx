import { Suspense } from "react";

import UploadPageClient from "./upload-page-client";

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-bg px-5 pb-20 pt-28 sm:px-8">
          <div className="mx-auto max-w-wrap">
            <div className="mx-auto max-w-[720px]">
              <p className="text-sm text-ink-dim">
                Loading RecruitOS...
              </p>
            </div>
          </div>
        </main>
      }
    >
      <UploadPageClient />
    </Suspense>
  );
}