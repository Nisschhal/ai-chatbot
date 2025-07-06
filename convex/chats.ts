import { mutation, query } from "./_generated/server"

import { v } from "convex/values"

export const createChat = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error(
        "Not Unauthorized! You must be signed in to create a chat."
      )
    }
    const chat = await ctx.db.insert("chats", {
      title: args.title,
      userId: identity.subject,
      createdAt: Date.now(),
    })
    return chat
  },
})

export const deleteChat = mutation({
  args: {
    id: v.id("chats"),
  },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error(
        "Not Unauthorized! You must be signed in to delete a chat."
      )
    }
    const chat = await ctx.db.get(id)
    if (!chat || chat.userId !== identity.subject) {
      throw new Error(
        "Not Authorized! You must be the owner of the chat to delete it."
      )
    }
    // Delete all messages in the chat
    const message = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", id))
      .collect()

    for (const msg of message) {
      await ctx.db.delete(msg._id)
    }

    // Delete the chat
    await ctx.db.delete(id)
  },
})

export const listChats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error(
        "Not Unauthorized! You must be signed in to view your chats."
      )
    }
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect()

    return chats
  },
})
