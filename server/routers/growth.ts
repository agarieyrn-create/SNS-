import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { reviewPost } from "../growth-utils";
import { invokeLLM, listLLMModels } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import { AI_PROVIDERS, generateWithProviderPriority, parseJsonResponse, providerDefaults } from "../ai-provider-gateway";

const ideaInput = z.object({
  title: z.string().trim().min(1).max(180),
  summary: z.string().max(4000).nullable().optional(),
  category: z.string().trim().min(1).max(80),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  sourceUrl: z.string().url().max(2048).nullable().optional(),
  personalExperience: z.string().max(4000).nullable().optional(),
  targetUser: z.string().max(180).nullable().optional(),
  angle: z.string().max(2000).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["unused", "drafting", "published", "archived"]),
});

const resultInput = z.object({
  ideaId: z.number().int().positive().nullable().optional(),
  draftId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(180),
  category: z.string().trim().min(1).max(80),
  postUrl: z.string().url().max(2048).nullable().optional(),
  postedAt: z.coerce.date(),
  impressions: z.number().int().min(0),
  engagements: z.number().int().min(0),
  likes: z.number().int().min(0),
  replies: z.number().int().min(0),
  reposts: z.number().int().min(0),
  bookmarks: z.number().int().min(0),
  clicks: z.number().int().min(0),
  notes: z.string().max(4000).nullable().optional(),
});

const importedResultInput = resultInput.extend({
  ideaId: z.null().optional().default(null),
  draftId: z.null().optional().default(null),
});

const aiProviderInput = z.enum(AI_PROVIDERS);

async function generateJsonWithConfiguredProvider(userId: number, input: { system: string; prompt: string; builtInModel: string; schema: any }) {
  const connections = await db.getAiProviderConnectionsForUse(userId);
  return generateWithProviderPriority(connections, { system: input.system, prompt: input.prompt }, async () => {
    const response = await invokeLLM({
      model: input.builtInModel,
      messages: [{ role: "system", content: input.system }, { role: "user", content: input.prompt }],
      response_format: { type: "json_schema", json_schema: input.schema },
    });
    const content = response.choices[0]?.message.content;
    if (typeof content !== "string") throw new Error("内蔵AIから投稿案を取得できませんでした。");
    return content;
  });
}

export const growthRouter = router({
  dashboard: protectedProcedure.query(({ ctx }) => db.getDashboard(ctx.user.id)),
  models: protectedProcedure.query(async () => {
    const catalog = await listLLMModels();
    return catalog.data.map(model => ({ id: model.id }));
  }),
  aiConnections: router({
    list: protectedProcedure.query(async ({ ctx }) => ({
      providers: await db.listAiProviderConnections(ctx.user.id),
      defaults: AI_PROVIDERS.map(provider => ({ provider, ...providerDefaults[provider] })),
    })),
    save: protectedProcedure.input(z.object({ provider: aiProviderInput, apiKey: z.string().trim().min(10).max(500).optional(), model: z.string().trim().min(1).max(160), enabled: z.boolean(), priority: z.number().int().min(1).max(4) })).mutation(({ ctx, input }) => db.saveAiProviderConnection(ctx.user.id, input)),
    reorder: protectedProcedure.input(z.object({ priorities: z.array(z.object({ provider: aiProviderInput, priority: z.number().int().min(1).max(4), enabled: z.boolean() })).min(1).max(4) })).mutation(({ ctx, input }) => db.updateAiProviderPriority(ctx.user.id, input.priorities)),
    delete: protectedProcedure.input(z.object({ provider: aiProviderInput })).mutation(({ ctx, input }) => db.deleteAiProviderConnection(ctx.user.id, input.provider)),
  }),
  ideas: router({
    list: protectedProcedure.query(({ ctx }) => db.listIdeas(ctx.user.id)),
    create: protectedProcedure.input(ideaInput).mutation(({ ctx, input }) => db.createIdea(ctx.user.id, input)),
    update: protectedProcedure.input(ideaInput.extend({ id: z.number().int().positive() })).mutation(({ ctx, input }) => {
      const { id, ...updates } = input;
      return db.updateIdea(ctx.user.id, id, updates);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => db.deleteIdea(ctx.user.id, input.id)),
  }),
  drafts: router({
    list: protectedProcedure.query(({ ctx }) => db.listDrafts(ctx.user.id)),
    update: protectedProcedure.input(z.object({
      id: z.number().int().positive(), content: z.string().trim().min(1).max(2000), tone: z.string().trim().min(1).max(80), charLimit: z.number().int().min(50).max(1000), status: z.enum(["generated", "selected", "published", "discarded"]),
    })).mutation(async ({ ctx, input }) => {
      const settings = await db.getGrowthSettings(ctx.user.id);
      return db.updateDraft(ctx.user.id, input.id, input.content, input.tone, input.charLimit, input.status, settings.bannedWords);
    }),
    rewrite: protectedProcedure.input(z.object({ id: z.number().int().positive(), model: z.string().trim().min(1).max(120) })).mutation(async ({ ctx, input }) => {
      const draft = (await db.listDrafts(ctx.user.id)).find(item => item.id === input.id);
      if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "投稿案が見つかりません。" });
      const settings = await db.getGrowthSettings(ctx.user.id);
      const system = "あなたは日本語SNSの編集者です。事実を追加・捏造せず、禁止表現と文字数を守り、編集後の投稿本文だけをJSONで返します。";
      const prompt = [
        `元の投稿案: ${draft.content}`,
        `トーン: ${draft.tone}`,
        `上限文字数: ${draft.charLimit}字`,
        `禁止ワード: ${settings.bannedWords.join("、") || "なし"}`,
        `運用ルール: ${settings.analysisRules || "なし"}`,
        `品質警告: ${draft.warnings.join("、") || "特になし"}`,
        "警告を解消しつつ、具体性・一次体験・読みやすさを高めて書き直してください。",
      ].join("\n");
      let content: string;
      try {
        content = (await generateJsonWithConfiguredProvider(ctx.user.id, { system, prompt, builtInModel: input.model, schema: { name: "rewritten_social_post", strict: true, schema: { type: "object", properties: { content: { type: "string", minLength: 1, maxLength: 2000 } }, required: ["content"], additionalProperties: false } } })).content;
      } catch (error) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "AIから改善案を取得できませんでした。" });
      }
      let parsed: { content: string };
      try { parsed = parseJsonResponse(content) as { content: string }; } catch { throw new TRPCError({ code: "BAD_GATEWAY", message: "AIの改善案を読み取れませんでした。" }); }
      const rewritten = parsed.content.trim();
      if (!rewritten) throw new TRPCError({ code: "BAD_GATEWAY", message: "AIの改善案が空でした。" });
      const updated = await db.updateDraft(ctx.user.id, draft.id, rewritten, draft.tone, draft.charLimit, draft.status, settings.bannedWords);
      return { draft: updated, before: reviewPost(draft.content, draft.charLimit, settings.bannedWords), after: reviewPost(rewritten, draft.charLimit, settings.bannedWords) };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => db.deleteDraft(ctx.user.id, input.id)),
  }),
  generate: protectedProcedure.input(z.object({
    ideaId: z.number().int().positive(), tone: z.string().trim().min(1).max(80), charLimit: z.number().int().min(50).max(1000), count: z.number().int().min(1).max(5), model: z.string().trim().min(1).max(120),
  })).mutation(async ({ ctx, input }) => {
    const idea = (await db.listIdeas(ctx.user.id)).find(item => item.id === input.ideaId);
    if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "選択した投稿ネタが見つかりません。" });
    const settings = await db.getGrowthSettings(ctx.user.id);
    const prompt = [
      `投稿ネタ: ${idea.title}`,
      `概要: ${idea.summary ?? "なし"}`,
      `切り口: ${idea.angle ?? "なし"}`,
      `本人の体験: ${idea.personalExperience ?? "なし"}`,
      `想定読者: ${idea.targetUser ?? "なし"}`,
      `カテゴリ: ${idea.category}`,
      `トーン: ${input.tone}`,
      `上限文字数: ${input.charLimit}字`,
      `投稿数: ${input.count}案`,
      `運用ルール: ${settings.analysisRules ?? "なし"}`,
      "日本語のX投稿案を作成してください。曖昧な一般論を避け、本人の一次体験や具体的な学びを中心にします。ハッシュタグは多用せず、各案は単体で読めるようにしてください。",
    ].join("\n");
    let content: string;
    try {
      content = (await generateJsonWithConfiguredProvider(ctx.user.id, {
        system: "あなたは日本語SNS編集者です。過剰な煽りや事実の捏造をせず、指示されたJSONのみを返します。",
        prompt,
        builtInModel: input.model,
        schema: { name: "social_post_drafts", strict: true, schema: { type: "object", properties: { posts: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 } }, required: ["posts"], additionalProperties: false } },
      })).content;
    } catch (error) {
      throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "AIから投稿案を取得できませんでした。" });
    }
    let parsed: { posts: string[] };
    try {
      parsed = parseJsonResponse(content) as { posts: string[] };
    } catch {
      throw new TRPCError({ code: "BAD_GATEWAY", message: "AIの応答形式を読み取れませんでした。" });
    }
    const posts = parsed.posts.map(post => post.trim()).filter(Boolean).slice(0, input.count);
    await db.createDrafts(ctx.user.id, idea.id, input.tone, input.charLimit, posts, settings.bannedWords);
    await db.updateIdea(ctx.user.id, idea.id, { status: "drafting" });
    return { success: true, createdCount: posts.length };
  }),
  evaluate: protectedProcedure.input(z.object({ content: z.string().max(2000), charLimit: z.number().int().min(50).max(1000) })).query(async ({ ctx, input }) => {
    const settings = await db.getGrowthSettings(ctx.user.id);
    return reviewPost(input.content, input.charLimit, settings.bannedWords);
  }),
  results: router({
    list: protectedProcedure.query(({ ctx }) => db.listResults(ctx.user.id)),
    create: protectedProcedure.input(resultInput).mutation(({ ctx, input }) => db.createResult(ctx.user.id, input)),
    update: protectedProcedure.input(resultInput.extend({ id: z.number().int().positive() })).mutation(({ ctx, input }) => {
      const { id, ...updates } = input;
      return db.updateResult(ctx.user.id, id, updates);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => db.deleteResult(ctx.user.id, input.id)),
    previewImport: protectedProcedure.input(z.object({ rows: z.array(importedResultInput).min(1).max(500) })).mutation(({ ctx, input }) => db.previewResultImport(ctx.user.id, input.rows)),
    import: protectedProcedure.input(z.object({ rows: z.array(importedResultInput).min(1).max(500) })).mutation(({ ctx, input }) => db.importResults(ctx.user.id, input.rows)),
  }),
  settings: router({
    get: protectedProcedure.query(({ ctx }) => db.getGrowthSettings(ctx.user.id)),
    save: protectedProcedure.input(z.object({
      impressionsTarget: z.number().int().min(1).max(100000000), engagementRateTargetBps: z.number().int().min(1).max(10000), postsPerWeekTarget: z.number().int().min(1).max(100), bannedWords: z.array(z.string().trim().min(1).max(80)).max(100), analysisRules: z.string().max(5000).default(""), defaultTone: z.string().trim().min(1).max(80),
    })).mutation(({ ctx, input }) => db.saveGrowthSettings(ctx.user.id, input)),
  }),
  exportData: protectedProcedure.query(({ ctx }) => db.getExportData(ctx.user.id)),
});
