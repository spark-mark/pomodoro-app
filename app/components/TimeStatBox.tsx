import { useState } from "react";

export interface TimeStatBoxProps {
  title: string;
  minutes: number;
}

// function MyComponent() {
//   const [Time, SetTime] = useState(0);
// }
export default function TimeStatBox(props: TimeStatBoxProps) {
  let minutes = props.minutes % 60;
  let hours = (props.minutes - minutes) / 60;

  return (
    <div>
      <h2>{props.title}</h2>
      <div className="flex flex-row items-baseline gap-0.5">
        <h3>{hours}</h3>
        <p>h</p>
        <h3>{minutes}</h3>
        <p>m</p>
      </div>
    </div>
  );
}
