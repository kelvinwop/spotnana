import assert from "node:assert/strict";
import test from "node:test";
import {
  getInteractiveFormControlClassName,
  getInteractivePointerClassName,
  interactiveFormControlPointerClassName,
  interactivePointerClassName,
} from "@/lib/interactiveStyles";

test("getInteractivePointerClassName adds cursor-pointer by default", () => {
  assert.equal(getInteractivePointerClassName(), interactivePointerClassName);
});

test("getInteractivePointerClassName preserves pointer plus disabled override when merging other classes", () => {
  assert.equal(
    getInteractivePointerClassName("w-full text-left"),
    "cursor-pointer disabled:cursor-not-allowed w-full text-left"
  );
});

test("getInteractiveFormControlClassName keeps pointer for active controls and not-allowed for disabled state", () => {
  assert.equal(
    getInteractiveFormControlClassName("h-4 w-4 rounded"),
    `${interactiveFormControlPointerClassName} h-4 w-4 rounded`
  );
});
