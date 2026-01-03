"use client";

import NumStatBox from "./components/NumStatBox";
import TimeStatBox from "./components/TimeStatBox";

export default function Home() {
  return (
    <div className="h-screen w-screen flex flex-row">
      <div>
        <img src="/stats_inactive.svg" className="absolute right-2 bottom-2"></img>
      </div>
      {/*timer section*/}
      <div className="grow flex flex-col items-center justify-center gap-4  bg-amber-600">
        <div className="flex flex-row gap-1.5">
          <p>Focusing</p>
          <img src="/arrow.svg" className="scale-75"></img>
          <p>Short Break</p>
        </div>
        <div>
          <h1>25:00</h1>
        </div>
        <div>
          <img src="/play.svg"></img>
        </div>
      </div>
      <div className="w-[390] flex flex-col gap-5 m-4 border">
        {/*stats section*/}
        <div className="flex flex-row justify-between border">
          {/*focus stats */}
          <div className="flex flex-col">
            <NumStatBox title="Today's Pomos" statistic={9}></NumStatBox>
            <NumStatBox title="Total Pomos" statistic={12}></NumStatBox>
          </div>
          <div className="flex flex-col">
            <TimeStatBox
              title="Today's Focus Duration"
              minutes={230}
            ></TimeStatBox>
            <TimeStatBox
              title="Total Focus Duration"
              minutes={600}
            ></TimeStatBox>
          </div>
        </div>
        <div className="grow flex flex-col rounded-2xl bg-amber-200">
          {/*calendar placeholder*/}
          <p>test</p>
        </div>
      </div>
    </div>
  );
}
