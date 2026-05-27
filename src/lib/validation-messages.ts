const messageFor = (input: HTMLInputElement, fieldLabel?: string): string => {
  const v = input.validity;
  const label = fieldLabel || "campo";
  if (v.valueMissing) return `Preencha o ${label}.`;
  if (v.typeMismatch) {
    if (input.type === "email") return "Digite um email válido (ex: nome@dominio.com).";
    if (input.type === "url") return "Digite uma URL válida.";
    return "Formato inválido.";
  }
  if (v.tooShort) {
    const min = input.minLength;
    const cur = input.value.length;
    return `A senha precisa ter pelo menos ${min} caracteres. Você digitou ${cur}.`;
  }
  if (v.tooLong) return `Máximo de ${input.maxLength} caracteres.`;
  if (v.patternMismatch) return "Formato inválido.";
  if (v.rangeUnderflow) return `Valor mínimo: ${input.min}.`;
  if (v.rangeOverflow) return `Valor máximo: ${input.max}.`;
  if (v.stepMismatch) return "Valor inválido.";
  return "Valor inválido.";
};

export function ptValidation(fieldLabel?: string) {
  return {
    onInvalid: (e: React.InvalidEvent<HTMLInputElement>) => {
      e.currentTarget.setCustomValidity(messageFor(e.currentTarget, fieldLabel));
    },
    onInput: (e: React.FormEvent<HTMLInputElement>) => {
      e.currentTarget.setCustomValidity("");
    },
  };
}