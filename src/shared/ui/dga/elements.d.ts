/**
 * JSX types for the DGA custom elements used by the application
 * (React 19 renders custom elements natively; properties map to
 * attributes, `on*` handlers map to DOM events). Extend only when a
 * new `dga-*` element is registered in dga/registrar.client.tsx.
 */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "dga-button-v2": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        label?: string;
        variant?:
          | "primary"
          | "neutral"
          | "secondary-solid"
          | "secondary-outline"
          | "subtle"
          | "transparent";
        size?: "lg" | "md" | "sm";
        type?: "button" | "submit" | "reset";
        disabled?: boolean;
      };
    }
  }
}

export {};
