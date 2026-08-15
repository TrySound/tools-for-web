export type JsonReferenceError = {
  path: string;
  message: string;
};

export type MaterializedJson = {
  value: unknown;
  errors: JsonReferenceError[];
};

const decodePointerSegment = (segment: string): string | undefined => {
  if (/~(?![01])/u.test(segment)) {
    return undefined;
  }

  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
};

const normalizeJsonPointer = (pointer: string): string | undefined => {
  if (!pointer.startsWith("#")) {
    return pointer;
  }

  try {
    return decodeURIComponent(pointer.slice(1));
  } catch {
    return undefined;
  }
};

export const resolveJsonPointer = (
  root: unknown,
  pointer: string,
): unknown | undefined => {
  const normalizedPointer = normalizeJsonPointer(pointer);

  if (normalizedPointer === undefined) {
    return undefined;
  }
  if (normalizedPointer === "") {
    return root;
  }
  if (!normalizedPointer.startsWith("/")) {
    return undefined;
  }

  let current = root;
  for (const encodedSegment of normalizedPointer.slice(1).split("/")) {
    const segment = decodePointerSegment(encodedSegment);
    if (segment === undefined || current === null) {
      return undefined;
    }

    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/u.test(segment)) {
        return undefined;
      }
      const index = Number(segment);
      if (index >= current.length) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    if (typeof current !== "object") {
      return undefined;
    }
    if (!Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};

const encodePointerSegment = (segment: string): string =>
  segment.replaceAll("~", "~0").replaceAll("/", "~1");

const cloneJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(cloneJson);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneJson(child)]),
    );
  }
  return value;
};

export const materializeJsonReferences = (input: unknown): MaterializedJson => {
  const errors: JsonReferenceError[] = [];

  const materialize = (
    value: unknown,
    path: string,
    referenceStack: string[],
  ): unknown => {
    if (Array.isArray(value)) {
      return value.map((child, index) =>
        materialize(child, `${path}/${index}`, referenceStack),
      );
    }
    if (value === null || typeof value !== "object") {
      return value;
    }

    const object = value as Record<string, unknown>;
    if (typeof object.$ref === "string") {
      const reference = object.$ref;
      const errorPath = `${path}/$ref`;

      if (!reference.startsWith("#")) {
        errors.push({
          path: errorPath,
          message: `External JSON reference is not supported: "${reference}"`,
        });
        return cloneJson(value);
      }
      if (
        (reference !== "#" && !reference.startsWith("#/")) ||
        normalizeJsonPointer(reference) === undefined
      ) {
        errors.push({
          path: errorPath,
          message: `Unsupported or malformed JSON reference: "${reference}"`,
        });
        return cloneJson(value);
      }
      if (referenceStack.includes(reference)) {
        errors.push({
          path: errorPath,
          message: `Circular JSON reference: "${reference}"`,
        });
        return cloneJson(value);
      }

      const target = resolveJsonPointer(input, reference);
      if (target === undefined) {
        errors.push({
          path: errorPath,
          message: `JSON Pointer target not found: "${reference}"`,
        });
        return cloneJson(value);
      }

      const errorCount = errors.length;
      const materializedTarget = materialize(target, path, [
        ...referenceStack,
        reference,
      ]);
      if (errors.length > errorCount) {
        return cloneJson(value);
      }

      const siblingEntries = Object.entries(object).filter(
        ([key]) => key !== "$ref",
      );
      if (
        siblingEntries.length > 0 &&
        (materializedTarget === null ||
          typeof materializedTarget !== "object" ||
          Array.isArray(materializedTarget))
      ) {
        errors.push({
          path: errorPath,
          message: `JSON reference target must be an object when siblings are present: "${reference}"`,
        });
        return cloneJson(value);
      }
      if (siblingEntries.length === 0) {
        return materializedTarget;
      }

      const siblings = Object.fromEntries(
        siblingEntries.map(([key, child]) => [
          key,
          key === "$extensions"
            ? cloneJson(child)
            : materialize(
                child,
                `${path}/${encodePointerSegment(key)}`,
                referenceStack,
              ),
        ]),
      );

      return {
        ...(materializedTarget as Record<string, unknown>),
        ...siblings,
      };
    }

    return Object.fromEntries(
      Object.entries(object).map(([key, child]) => [
        key,
        key === "$extensions"
          ? cloneJson(child)
          : materialize(
              child,
              `${path}/${encodePointerSegment(key)}`,
              referenceStack,
            ),
      ]),
    );
  };

  return { value: materialize(input, "", []), errors };
};
