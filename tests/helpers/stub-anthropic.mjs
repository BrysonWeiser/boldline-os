// Anthropic, without the network or the bill. Returns whatever the test put in
// `__STUB.ai`, or throws `__STUB.aiThrows`, and records the request so a test can check
// what was actually asked for (the tool, the system prompt, the model).

const S = () => globalThis.__STUB;

export default class Anthropic {
  constructor() {
    this.messages = {
      create: async (req) => {
        S().calls.push(req);
        if (S().aiThrows) throw new Error(S().aiThrows);
        return S().ai;
      },
    };
  }
}
