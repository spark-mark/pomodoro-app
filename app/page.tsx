"use client";

export default function Home() {
  return (
    <div className=" h-screen w-[70%] bg-amber-600">
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <div className="flex flex-row gap-1.5">
          <p>Focusing</p>
          <img src="/arrow.svg"></img>
          <p>Short Break</p>
        </div>
        <div>
          <h1>25:00</h1>
        </div>
        <div>
          <img src="/play.svg"></img>
        </div>
      </div>
      <div> {/*stats section*/}</div>
    </div>
  );
}
