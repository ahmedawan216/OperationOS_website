import OpenAI from "openai";
import { z } from "zod";

import { normalizeEmail, normalizeSkills } from "@/lib/recruitos/skills";

let extractorClient: OpenAI | null = null;

function getExtractorClient(): OpenAI {
  if (extractorClient) return extractorClient;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("AI provider is not configured.");

  extractorClient = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  return extractorClient;
}

const candidateProfileSchema = z.object({
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  headline: z.string().nullable(),
  skills: z.array(z.string()),
  experience: z.array(
    z.object({
      company: z.string().nullable(),
      title: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      description: z.string().nullable(),
    })
  ),
  education: z.array(
    z.object({
      institution: z.string().nullable(),
      degree: z.string().nullable(),
      field: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
    })
  ),
  yearsExperience: z.number().min(0).nullable(),
});

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;

export async function extractCandidateProfile(resumeText: string): Promise<CandidateProfile> {
  const extractor = getExtractorClient();

  const completion = await extractor.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `Extract a candidate profile from the resume. Use only information present in the resume. Never invent missing values. Return JSON only with exactly these fields: fullName, email, phone, location, headline, skills, experience, education, yearsExperience. Use null when unknown. Keep dates as written when possible. yearsExperience must be a conservative numeric estimate or null.`,
      },
      { role: "user", content: resumeText.slice(0, 50000) },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("The AI provider returned an empty response.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("The AI provider returned invalid structured data.");
  }

  const result = candidateProfileSchema.safeParse(parsed);
  if (!result.success) throw new Error("The AI provider returned an unexpected candidate profile.");

  return {
    ...result.data,
    email: normalizeEmail(result.data.email),
    skills: normalizeSkills(result.data.skills),
  };
}
