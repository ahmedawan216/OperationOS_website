import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        {
          error: "Job ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .select(
        "id, title, description, status"
      )
      .eq("id", jobId)
      .single();

    if (error) {
      console.error(
        "Supabase job fetch error:",
        error
      );

      return NextResponse.json(
        {
          error: "Failed to load the job.",
        },
        {
          status: 500,
        }
      );
    }

    if (!job) {
      return NextResponse.json(
        {
          error: "Job not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      job,
    });
  } catch (error) {
    console.error(
      "Unexpected job API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while loading the job.",
      },
      {
        status: 500,
      }
    );
  }
}
