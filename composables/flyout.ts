export const useFlyout = () =>
    useState<{
        title?: string;
        position: number[];
        origin?: "top" | "bottom";
        orientation?: "left" | "right";
        id: string;
        element?: Element;
        groups: FlyoutGroups;
    }>("flyout-data");

export type FlyoutGroups = {
    title: string;
    text?: string;
    icon?: string[];
}[][];

export const FLYOUT_WIDTH = 190;
