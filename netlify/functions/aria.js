const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

const DELETE_CLIENT_TOOL = {
  name: "delete_client",
  description:
    "Permanently delete a client from the agency dashboard. Only call this when the user has clearly asked to delete a specific, named client. The user will see an on-screen confirmation button before anything is actually deleted, so you don't need to double-check in chat first.",
  input_schema: {
    type: "object",
    properties: {
      client_name: {
        type: "string",
        description: "The exact name of the client to delete, as it appears in the client list.",
      },
    },
    required: ["client_name"],
  },
};

const PROPOSE_ACTION_TOOL = {
  name: "propose_action",
  description:
    "Propose a specific, concrete action on a named client's behalf that needs Bryson's approval before anything happens — e.g. a budget change, pausing an underperforming campaign, a creative refresh, or any other change with real-world or financial impact. This only logs the proposal to Bryson's approval queue (Notifications); it never executes anything by itself, and Bryson can approve or reject it later. Call this any time you'd otherwise just tell him 'you should...' about a specific client — propose it instead of only saying it in chat. Logging the proposal is safe and doesn't need confirmation, so just call the tool.",
  input_schema: {
    type: "object",
    properties: {
      client_name: {
        type: "string",
        description: "The exact name of the client this action concerns, as it appears in the client list.",
      },
      title: {
        type: "string",
        description: "A short title for the proposed action, under 60 characters, e.g. \"Increase ad budget to $3,500/mo\".",
      },
      detail: {
        type: "string",
        description: "1-3 sentences explaining the proposed action and why you're recommending it now.",
      },
      category: {
        type: "string",
        enum: ["budget", "creative", "targeting", "pause", "other"],
        description: "The kind of action being proposed.",
      },
    },
    required: ["client_name", "title", "detail", "category"],
  },
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { system, messages, enableTools } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "messages array required" }) };
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1200,
      system: system || undefined,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: enableTools ? [DELETE_CLIENT_TOOL, PROPOSE_ACTION_TOOL] : undefined,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: response.content }),
    };
  } catch (err) {
    console.error("Anthropic API error:", err);
    return {
      statusCode: err.status || 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "AI request failed" }),
    };
  }
};
