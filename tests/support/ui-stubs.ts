import { defineComponent, h } from "vue";

export const NInputStub = defineComponent({
   name: "NInput",
   props: {
      value: { type: String, default: "" },
      disabled: { type: Boolean, default: false },
      placeholder: { type: String, default: "" },
   },
   emits: ["update:value"],
   setup(props, { emit }) {
      return () =>
         h("input", {
            value: props.value,
            disabled: props.disabled,
            placeholder: props.placeholder,
            onInput: (event: Event) => {
               const target = event.target as HTMLInputElement;
               emit("update:value", target.value);
            },
         });
   },
});

export const NButtonStub = defineComponent({
   name: "NButton",
   props: {
      disabled: { type: Boolean, default: false },
      loading: { type: Boolean, default: false },
   },
   emits: ["click"],
   setup(props, { slots, emit }) {
      return () =>
         h(
            "button",
            {
               disabled: props.disabled,
               "data-loading": String(props.loading),
               onClick: () => emit("click"),
            },
            slots.default ? slots.default() : [],
         );
   },
});

export const NFormStub = defineComponent({
   name: "NForm",
   emits: ["keydown.enter"],
   setup(_, { slots, emit }) {
      return () =>
         h(
            "form",
            {
               onKeydown: (e: KeyboardEvent) => {
                  if (e.key === "Enter") emit("keydown.enter");
               },
            },
            slots.default ? slots.default() : [],
         );
   },
});

export const NFormItemStub = defineComponent({
   name: "NFormItem",
   props: {
      label: { type: String, default: "" },
      feedback: { type: String, default: "" },
      validationStatus: { type: String, default: "success" },
   },
   setup(props, { slots }) {
      return () =>
         h("div", { "data-validation": props.validationStatus }, [
            h("label", props.label),
            slots.default ? slots.default() : [],
            h("p", { class: "feedback" }, props.feedback),
         ]);
   },
});

export const NTextStub = defineComponent({
   name: "NText",
   setup(_, { slots }) {
      return () => h("span", slots.default ? slots.default() : []);
   },
});

export function buildNaiveUiStubs() {
   return {
      NInput: NInputStub,
      NButton: NButtonStub,
      NForm: NFormStub,
      NFormItem: NFormItemStub,
      NText: NTextStub,
      NSpin: defineComponent({ name: "NSpin", setup: () => () => h("div") }),
   };
}
