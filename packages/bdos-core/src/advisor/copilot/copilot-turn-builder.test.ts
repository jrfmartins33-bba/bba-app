import Anthropic from "@anthropic-ai/sdk";
import { isAnthropicProviderError } from "./copilot-turn-builder";

runTest("isAnthropicProviderError reconhece um erro de billing/crédito do SDK Anthropic", () => {
  const error = new Anthropic.BadRequestError(
    400,
    { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low..." } },
    "Your credit balance is too low...",
    new Headers()
  );

  assertTrue(isAnthropicProviderError(error), "erro do SDK Anthropic deve ser reconhecido como erro de provedor");
});

runTest("isAnthropicProviderError não confunde um erro interno qualquer com um erro do provedor", () => {
  assertTrue(!isAnthropicProviderError(new Error("falha qualquer no nosso código")), "Error genérico não é erro de provedor");
  assertTrue(!isAnthropicProviderError("string qualquer"), "valor não-Error não é erro de provedor");
  assertTrue(!isAnthropicProviderError(null), "null não é erro de provedor");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}
