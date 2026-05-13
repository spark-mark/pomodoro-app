import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import Activitytimeline from '@/app/components/ActivityTimeline';
import StatBox from '@/app/components/StatBox';
import HomePage from '@/app/page';

const page: TempoPage = {
  name: "Pomodoro App",
};

export default page;

export const Home: TempoStoryboard = {
  render: () => <HomePage />,
  name: "Home Page",
  layout: { x: 0, y: 0, width: 1440, height: 900 },
};

export const NumStat: TempoStoryboard = {
  render: () => <StatBox title="Today's Pomos" value={9} />,
  name: "StatBox — Number",
  layout: { x: 1490, y: 0, width: 300, height: 200 },
};

export const TimeStat: TempoStoryboard = {
  render: () => <StatBox title="Today's Focus Duration" value={230} format="time" />,
  name: "StatBox — Time",
  layout: { x: 1840, y: 0, width: 300, height: 200 },
};

export const Timeline: TempoStoryboard = {
  render: () => <Activitytimeline />,
  name: "ActivityTimeline",
  layout: { x: 2190, y: 0, width: 400, height: 550 },
};
