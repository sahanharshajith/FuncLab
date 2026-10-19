declare module "plotly.js-dist-min" {
  export type PlotTrace = Record<string, unknown>;
  export type PlotLayout = Record<string, unknown>;
  export type PlotConfig = Record<string, unknown>;

  export interface PlotlyHoverPoint {
    x: unknown;
    y: unknown;
    data?: { name?: string };
    curveNumber?: number;
    pointNumber?: number;
  }

  export interface PlotlyEventData {
    points?: PlotlyHoverPoint[];
  }

  export interface PlotlyHTMLElement extends HTMLElement {
    on(event: string, handler: (event: PlotlyEventData) => void): void;
    removeAllListeners?: (event?: string) => void;
    data?: PlotTrace[];
    layout?: PlotLayout;
  }

  export function newPlot(
    root: HTMLElement,
    data: PlotTrace[],
    layout?: PlotLayout,
    config?: PlotConfig,
  ): Promise<PlotlyHTMLElement>;

  export function react(
    root: HTMLElement,
    data: PlotTrace[],
    layout?: PlotLayout,
    config?: PlotConfig,
  ): Promise<PlotlyHTMLElement>;

  export function relayout(root: HTMLElement, layout: PlotLayout): Promise<PlotlyHTMLElement>;

  export function purge(root: HTMLElement): void;

  export function downloadImage(
    root: HTMLElement,
    options: {
      format: "png" | "svg" | "jpeg" | "webp";
      filename?: string;
      width?: number;
      height?: number;
      scale?: number;
    },
  ): Promise<string>;

  export const Plots: {
    resize(root: HTMLElement): void;
  };

  const Plotly: {
    newPlot: typeof newPlot;
    react: typeof react;
    relayout: typeof relayout;
    purge: typeof purge;
    downloadImage: typeof downloadImage;
    Plots: typeof Plots;
  };

  export default Plotly;
}
