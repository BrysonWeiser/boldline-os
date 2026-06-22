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
      tools: enableTools ? [DELETE_CLIENT_TOOL] : undefined,
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
