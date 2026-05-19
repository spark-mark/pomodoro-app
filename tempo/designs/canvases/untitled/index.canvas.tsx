import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import Storyboard1Component from "./Storyboard1";

const page: TempoPage = {
  name: "untitled",
};

export default page;

export const Storyboard1: TempoStoryboard = {
  render: () => <Storyboard1Component />,
  name: "Storyboard1",
  layout: { x: 197, y: 414, width: 223, height: 290, intrinsicSizing: "root-element" },
};
