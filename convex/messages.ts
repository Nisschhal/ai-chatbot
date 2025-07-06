import { mutation, query } from "./_generated/server"

import { v } from "convex/values"

const SHOW_COMMENTS = false

export const list = query({
  args: {
    chatId: v.id("chats"),
  },

  handler: async ({ db }, { chatId }) => {
    const messages = await db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .order("asc")
      .collect()
    return messages
  },
})

export const send = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // save the user message with preserved newlines
    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      content: args.content.replace(/\n/g, "\\n"),
      role: "user",
      createdAt: Date.now(),
    })
    return messageId
  },
})

export const store = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
  },
  handler: async (ctx, args) => {
    // save the user message with preserved newlines
    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      content: args.content
        .replace(/\n/g, "\\n")
        // Don't escape HTML - we'll trust the content since it's from the AI
        .replace(/\\/g, "\\\\"),
      role: args.role,
      createdAt: Date.now(),
    })
    return messageId
  },
})
