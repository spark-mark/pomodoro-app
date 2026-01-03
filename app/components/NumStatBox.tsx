export interface NumStatBoxProps {
  title: string;
  statistic: number;
}

export default function NumStatBox(props: NumStatBoxProps) {
  return (
    <div>
      <h2>{props.title}</h2>
      <h3>{props.statistic}</h3>
    </div>
  )
}