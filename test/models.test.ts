import { describe, expect, it } from "vitest";
import {
  filterModelsByRegion,
  KIRO_MODEL_IDS,
  kiroModels,
  resolveApiRegion,
  resolveKiroModel,
  toKiroModelDefinition,
} from "../src/models.js";

describe("Feature 2: Model Definitions", () => {
  describe("resolveKiroModel", () => {
    it.each([
      // Claude models - dash to dot conversion
      ["claude-opus-4-8", "claude-opus-4.8"],
      ["claude-opus-4-7", "claude-opus-4.7"],
      ["claude-opus-4-6", "claude-opus-4.6"],
      ["claude-sonnet-5", "claude-sonnet-5"],
      ["claude-sonnet-4-6", "claude-sonnet-4.6"],
      ["claude-sonnet-4-5", "claude-sonnet-4.5"],
      ["claude-sonnet-4", "claude-sonnet-4"],
      ["claude-haiku-4-5", "claude-haiku-4.5"],
      // Non-Claude models
      ["deepseek-3-2", "deepseek-3.2"],
      ["minimax-m2-1", "minimax-m2.1"],
      ["glm-5", "glm-5"],
      ["qwen3-coder-next", "qwen3-coder-next"],
    ])("maps %s → %s", (piId, kiroId) => {
      expect(resolveKiroModel(piId)).toBe(kiroId);
    });

    it("throws on unknown model ID", () => {
      expect(() => resolveKiroModel("nonexistent")).toThrow("Unknown Kiro model ID");
    });
  });

  describe("KIRO_MODEL_IDS", () => {
    it("contains 17 model IDs", () => {
      expect(KIRO_MODEL_IDS.size).toBe(17);
    });
  });

  describe("resolveApiRegion", () => {
    it("maps us-east-2 to us-east-1", () => {
      expect(resolveApiRegion("us-east-2")).toBe("us-east-1");
    });

    it("maps eu-west-1 to eu-central-1", () => {
      expect(resolveApiRegion("eu-west-1")).toBe("eu-central-1");
    });

    it("maps ap-southeast-2 to us-east-1", () => {
      expect(resolveApiRegion("ap-southeast-2")).toBe("us-east-1");
    });

    it("passes through us-east-1 unchanged", () => {
      expect(resolveApiRegion("us-east-1")).toBe("us-east-1");
    });

    it("defaults to us-east-1 when undefined", () => {
      expect(resolveApiRegion(undefined)).toBe("us-east-1");
    });
  });

  describe("filterModelsByRegion", () => {
    it("us-east-1 returns all models", () => {
      expect(filterModelsByRegion(kiroModels, "us-east-1")).toHaveLength(kiroModels.length);
    });

    it("eu-central-1 includes Claude + documented OSS, excludes DeepSeek and undocumented models", () => {
      const ids = filterModelsByRegion(kiroModels, "eu-central-1").map((m) => m.id);
      expect(ids).toContain("claude-sonnet-4-6");
      expect(ids).toContain("minimax-m2-1");
      expect(ids).not.toContain("deepseek-3-2");
      expect(ids).not.toContain("agi-nova-beta-1m");
    });

    it("unknown region returns no models", () => {
      expect(filterModelsByRegion(kiroModels, "af-south-1")).toHaveLength(0);
    });
  });

  describe("model catalog", () => {
    it("defines 14 models", () => {
      expect(kiroModels).toHaveLength(14);
    });

    it("claude-haiku-4-5 has reasoning=false", () => {
      expect(kiroModels.find((m) => m.id === "claude-haiku-4-5")?.reasoning).toBe(false);
    });

    it("flash models have reasoning=false", () => {
      const flashModels = kiroModels.filter((m) => m.id.includes("flash"));
      expect(flashModels.every((m) => m.reasoning === false)).toBe(true);
    });

    it("minimax has reasoning=false", () => {
      expect(kiroModels.find((m) => m.id === "minimax-m2-1")?.reasoning).toBe(false);
    });

    it("Claude models support text and image input", () => {
      const claudeModels = kiroModels.filter((m) => m.id.startsWith("claude-"));
      expect(claudeModels.every((m) => m.input.includes("text") && m.input.includes("image"))).toBe(true);
    });

    it("non-Claude models (except auto) support text only", () => {
      const textOnlyModels = kiroModels.filter((m) => !m.id.startsWith("claude-") && m.id !== "auto");
      expect(textOnlyModels.every((m) => m.input.includes("text") && !m.input.includes("image"))).toBe(true);
    });

    it("all models have zero cost", () => {
      expect(kiroModels.every((m) => m.cost.input === 0 && m.cost.output === 0)).toBe(true);
    });

    it("opus models have expected max tokens", () => {
      const opusModels = kiroModels.filter((m) => m.id.includes("opus"));
      expect(opusModels.every((m) => m.maxTokens === 32768 || m.maxTokens === 128000)).toBe(true);
    });

    it("non-Claude models (except auto) have 8K max tokens", () => {
      const nonClaudeModels = kiroModels.filter((m) => !m.id.startsWith("claude-") && m.id !== "auto");
      expect(nonClaudeModels.every((m) => m.maxTokens === 8192)).toBe(true);
    });
  });

  describe("dynamic model metadata", () => {
    it("uses API token limits, input types, and native reasoning schema", () => {
      const model = toKiroModelDefinition(
        {
          modelId: "gpt-5.6-sol",
          modelName: "GPT 5.6 Sol",
          supportedInputTypes: ["TEXT", "IMAGE"],
          tokenLimits: { maxInputTokens: 272000, maxOutputTokens: 128000 },
          additionalModelRequestFieldsSchema: {
            properties: {
              reasoning: {
                properties: {
                  mode: { enum: ["standard", "pro"], default: "standard" },
                  effort: { enum: ["none", "low", "medium", "high", "xhigh", "max"], default: "high" },
                },
              },
            },
          },
        },
        "https://q.us-east-1.amazonaws.com",
      );

      expect(model).toMatchObject({
        id: "gpt-5-6-sol",
        name: "GPT 5.6 Sol",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 272000,
        maxTokens: 128000,
        thinkingLevelMap: {
          off: "none",
          minimal: "low",
          low: "low",
          medium: "medium",
          high: "high",
          xhigh: "xhigh",
        },
        kiroReasoning: {
          mode: "standard",
          efforts: ["none", "low", "medium", "high", "xhigh", "max"],
        },
      });
    });

    it("does not claim native reasoning support when the API omits its schema", () => {
      const model = toKiroModelDefinition(
        {
          modelId: "glm-5",
          modelName: "GLM 5",
          supportedInputTypes: ["TEXT"],
          tokenLimits: { maxInputTokens: 200000, maxOutputTokens: 64000 },
          additionalModelRequestFieldsSchema: null,
        },
        "https://q.us-east-1.amazonaws.com",
      );

      expect(model.reasoning).toBe(false);
      expect(model.thinkingLevelMap).toBeUndefined();
      expect(model.kiroReasoning).toBeUndefined();
      expect(model.maxTokens).toBe(64000);
    });
  });

  // pi's UI exposes the `xhigh` thinking level only when a model's
  // `thinkingLevelMap.xhigh` is explicitly defined (not undefined, not null).
  // All other levels are opt-out. Mirror the pi-ai filter locally so this test
  // is self-contained and version-independent from @earendil-works/pi-ai.
  //
  // Source: @earendil-works/pi-ai models.ts → getSupportedThinkingLevels
  describe("thinkingLevelMap — pi UI exposes xhigh", () => {
    const EXTENDED_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
    type Level = (typeof EXTENDED_LEVELS)[number];

    function supportedLevels(model: (typeof kiroModels)[number]): Level[] {
      if (!model.reasoning) return ["off"];
      return EXTENDED_LEVELS.filter((level) => {
        const mapped = (model as { thinkingLevelMap?: Partial<Record<Level, string | null>> }).thinkingLevelMap?.[
          level
        ];
        if (mapped === null) return false;
        if (level === "xhigh") return mapped !== undefined;
        return true;
      });
    }

    const XHIGH_MODELS = ["claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6"];

    it("Opus 4.7/4.6 models offer xhigh (and all other levels)", () => {
      for (const m of kiroModels.filter((x) => XHIGH_MODELS.includes(x.id))) {
        expect(supportedLevels(m), `${m.id} supported levels`).toEqual([
          "off",
          "minimal",
          "low",
          "medium",
          "high",
          "xhigh",
        ]);
      }
    });

    it("other reasoning models offer up to high (no xhigh)", () => {
      for (const m of kiroModels.filter((x) => x.reasoning && !XHIGH_MODELS.includes(x.id))) {
        expect(supportedLevels(m), `${m.id} supported levels`).toEqual(["off", "minimal", "low", "medium", "high"]);
      }
    });

    it("non-reasoning models still collapse to ['off']", () => {
      for (const m of kiroModels.filter((x) => !x.reasoning)) {
        expect(supportedLevels(m), `${m.id} supported levels`).toEqual(["off"]);
      }
    });
  });
});
