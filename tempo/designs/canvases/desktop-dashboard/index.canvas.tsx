import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import Desktopdashboard from '@/app/components/DesktopDashboard';

const page: TempoPage = {
  name: "Desktop Dashboard",
};

export default page;

export const Dashboard: TempoStoryboard = {
  render: () => <Desktopdashboard />,
  name: "Desktop Dashboard — Full View",
  layout: { x: 0, y: 0, width: 1440, height: 900 },
};
