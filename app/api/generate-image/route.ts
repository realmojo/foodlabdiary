import { NextRequest, NextResponse } from "next/server";
import { getGoogleToken } from "@/lib/googleToken";

const getApiInfo = (
  prompt: string,
  imageType: "default" | "quokka" | "korean-anime" | "chibi" | "flat",
  aspectRatio: "IMAGE_ASPECT_RATIO_PORTRAIT" | "IMAGE_ASPECT_RATIO_LANDSCAPE",
) => {
  const seedNumber = Math.floor(100000 + Math.random() * 900000);
  const sessionId = `;${Date.now()}`;
  let apiUrl = "";
  let params = null;
  if (imageType === "quokka") {
    apiUrl = "https://aisandbox-pa.googleapis.com/v1/whisk:runImageRecipe";
    params = {
      clientContext: {
        workflowId: crypto.randomUUID(),
        tool: "BACKBONE",
        sessionId: sessionId,
      },
      seed: seedNumber,
      imageModelSettings: {
        imageModel: "IMAGEN_3_5",
        aspectRatio: aspectRatio,
      },
      userInstruction: prompt,
      recipeMediaInputs: [
        {
          caption:
            "Korean webtoon style, Manhwa style, digital illustration, clean line art, cel-shading, business casual clothes, lively expression, vibrant colors.",
          mediaInput: {
            mediaCategory: "MEDIA_CATEGORY_STYLE",
            mediaGenerationId:
              "CAMaJDE2NWYyZjgzLWNjM2YtNDRhMC1hMjUyLTQzNGY3ODgxOGI1ZiIDQ0JNKiQ3NjBiOGJmMy1mMjIyLTRhMzItYWNkYy04YWQxNGM1ZDZjOGU",
          },
        },
      ],
    };
  } else if (imageType === "korean-anime") {
    apiUrl = "https://aisandbox-pa.googleapis.com/v1/whisk:runImageRecipe";
    params = {
      clientContext: {
        workflowId: crypto.randomUUID(),
        tool: "BACKBONE",
        sessionId: sessionId,
      },
      seed: seedNumber,
      imageModelSettings: {
        imageModel: "IMAGEN_3_5",
        aspectRatio: "IMAGE_ASPECT_RATIO_SQUARE",
      },
      userInstruction: prompt,
      recipeMediaInputs: [
        {
          caption:
            "Korean webtoon style, Manhwa style, digital illustration, clean line art, cel-shading, business casual clothes, lively expression, vibrant colors.",
          mediaInput: {
            mediaCategory: "MEDIA_CATEGORY_STYLE",
            mediaGenerationId:
              "CAMaJDE2NWYyZjgzLWNjM2YtNDRhMC1hMjUyLTQzNGY3ODgxOGI1ZiIDQ0JNKiQ3NjBiOGJmMy1mMjIyLTRhMzItYWNkYy04YWQxNGM1ZDZjOGU",
          },
        },
      ],
    };
  } else if (imageType === "chibi") {
    apiUrl = "https://aisandbox-pa.googleapis.com/v1/whisk:runImageRecipe";
    params = {
      clientContext: {
        workflowId: crypto.randomUUID(),
        tool: "BACKBONE",
        sessionId: sessionId,
      },
      seed: seedNumber,
      imageModelSettings: {
        imageModel: "IMAGEN_3_5",
        aspectRatio: aspectRatio || "IMAGE_ASPECT_RATIO_SQUARE",
      },
      userInstruction: prompt,
      recipeMediaInputs: [
        {
          caption:
            "A digital illustration in a clean, appealing chibi anime or manga style with thick black outlines, featuring a soft, earthy color palette dominated by warm tones like beige, tan, light brown, and pale yellow. The lighting is soft and diffuse, creating a gentle, wholesome atmosphere. A young man or woman with brown hair and large, glossy brown eyes.",
          mediaInput: {
            mediaCategory: "MEDIA_CATEGORY_SUBJECT",
            mediaGenerationId:
              "CAMaJDFkNzZhN2Q0LTI0MWUtNDhmMS04MGQwLWE3NDI1NDU5NzI4MSIDQ0FNKiRjMTUyMjVkZS0wYjhjLTRmMjgtODkxOS1kYjY5NDdlNGYyZjQ",
          },
        },
        {
          caption:
            "A digital illustration in a clean, appealing chibi anime or manga style with thick black outlines, featuring a soft, earthy color palette dominated by warm tones like beige, tan, light brown, and pale yellow. The lighting is soft and diffuse, creating a gentle, wholesome atmosphere. A young man or woman with brown hair and large, glossy brown eyes.",
          mediaInput: {
            mediaCategory: "MEDIA_CATEGORY_STYLE",
            mediaGenerationId:
              "CAMaJDFkNzZhN2Q0LTI0MWUtNDhmMS04MGQwLWE3NDI1NDU5NzI4MSIDQ0FJKiQ2MmM4ZGRlZS0wNGVmLTQxZWEtYTFmNC1mYmU3Zjk4ZGNlYTU",
          },
        },
      ],
    };
  } else if (imageType === "flat") {
    apiUrl = "https://aisandbox-pa.googleapis.com/v1/whisk:runImageRecipe";
    params = {
      clientContext: {
        workflowId: crypto.randomUUID(),
        tool: "BACKBONE",
        sessionId: sessionId,
      },
      seed: seedNumber,
      imageModelSettings: {
        imageModel: "GEM_PIX",
        aspectRatio: aspectRatio || "IMAGE_ASPECT_RATIO_SQUARE",
      },
      userInstruction: prompt,
      recipeMediaInputs: [
        {
          caption:
            "A black and white stick figure drawing on a white background depicts a person walking or strolling with a happy expression. The figure is composed of thin, simple black lines. The head is a circle with two small curved lines for closed, smiling eyes and a horizontal line for a closed mouth, indicating contentment. The figure has short, spiky lines on top of the head representing hair. The body is a vertical line with a simple inverted trapezoid shape representing a torso or shirt. The limbs are thin lines ending in simple oval shapes for feet and hands. The figure is in mid-stride; the right leg is extended forward and slightly raised, and the left leg is vertical on the ground. The arms are slightly bent, and the hands are open with simple curved lines to suggest fingers. A few small curved lines are drawn near the figure's right shoulder, suggesting movement or a shrug. The bottom of the figure shows faint hatching lines, possibly suggesting a surface or shadow. The character is a highly simplified, gender-neutral representation of a person.",
          mediaInput: {
            mediaCategory: "MEDIA_CATEGORY_SUBJECT",
            mediaGenerationId:
              "CAMaJDM5MmU3ZTEwLTM5NDQtNDU1ZC05NDY2LTAyNDBhZmY4ZjYyMSIDQ0FNKiQ1ZWMzZDBiZi1hNGU4LTRmNzEtOTc5MC03NDIyYTliNDk2MWU",
          },
        },
        {
          caption:
            "A black and white stick figure drawing on a white background depicts a person walking or strolling with a happy expression. The figure is composed of thin, simple black lines. The head is a circle with two small curved lines for closed, smiling eyes and a horizontal line for a closed mouth, indicating contentment. The figure has short, spiky lines on top of the head representing hair. The body is a vertical line with a simple inverted trapezoid shape representing a torso or shirt. The limbs are thin lines ending in simple oval shapes for feet and hands. The figure is in mid-stride; the right leg is extended forward and slightly raised, and the left leg is vertical on the ground. The arms are slightly bent, and the hands are open with simple curved lines to suggest fingers. A few small curved lines are drawn near the figure's right shoulder, suggesting movement or a shrug. The bottom of the figure shows faint hatching lines, possibly suggesting a surface or shadow. The character is a highly simplified, gender-neutral representation of a person.",
          mediaInput: {
            mediaCategory: "MEDIA_CATEGORY_STYLE",
            mediaGenerationId:
              "CAMaJDM5MmU3ZTEwLTM5NDQtNDU1ZC05NDY2LTAyNDBhZmY4ZjYyMSIDQ0FJKiRlNzE5MWM0My1jZGY0LTQzNjAtOTA3ZC04MGU5ZjI4N2MyMmQ",
          },
        },
      ],
    };
  } else {
    apiUrl = "https://aisandbox-pa.googleapis.com/v1:runImageFx";
    params = {
      userInput: {
        candidatesCount: 1,
        prompts: [prompt],
        seed: seedNumber,
      },
      clientContext: { sessionId: sessionId, tool: "IMAGE_FX" },
      modelInput: { modelNameType: "IMAGEN_3_5" },
      aspectRatio: aspectRatio,
    };
  }

  return { apiUrl, params };
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, imageType = "default", aspectRatio = "IMAGE_ASPECT_RATIO_LANDSCAPE" } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { status: "error", message: "Prompt is required" },
        { status: 400 },
      );
    }

    const { apiUrl, params } = getApiInfo(
      prompt,
      imageType as "default" | "quokka" | "korean-anime" | "chibi" | "flat",
      aspectRatio as
        | "IMAGE_ASPECT_RATIO_PORTRAIT"
        | "IMAGE_ASPECT_RATIO_LANDSCAPE",
    );

    const authToken = await getGoogleToken();

    if (!authToken) {
      return NextResponse.json(
        { status: "error", message: "Google API token not configured" },
        { status: 500 },
      );
    }

    const headers: HeadersInit = {
      accept: "*/*",
      "accept-encoding": "gzip, deflate, br, zstd",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      authorization: `Bearer ${authToken}`,
      "content-type": "text/plain;charset=UTF-8",
      origin: "https://labs.google",
      referer: "https://labs.google/",
      "sec-ch-ua":
        '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "cross-site",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      "x-browser-channel": "stable",
      "x-browser-copyright": "Copyright 2025 Google LLC. All Rights reserved.",
      "x-browser-validation": "AUXUCdutEJ+6gl6bYtz7E2kgIT4=",
      "x-browser-year": "2025",
      "x-client-data":
        "CIu2yQEIpLbJAQipncoBCKfkygEIlKHLAQiGoM0BCJSkzwEY8aLPAQ==",
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google API error:", response.status, errorText);
      return NextResponse.json(
        {
          status: "error",
          message: `API request failed: ${response.status} ${response.statusText}`,
          details: errorText,
        },
        { status: response.status },
      );
    }

    const data = await response.json();

    return NextResponse.json({ status: "ok", data });
  } catch (error: any) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to generate image" },
      { status: 500 },
    );
  }
}
