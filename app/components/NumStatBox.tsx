export interface NumStatBoxProps {
  title: string;
  statistic: number;
  active: boolean;
}

export default function NumStatBox(props: NumStatBoxProps) {
  return (
    <div>
      <h2>{props.title}</h2>
    </div>
  )
}