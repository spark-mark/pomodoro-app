"use client";

export default function ActivityTimeline() {
  const timeLabels = [
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
  ];

  // Activity bars positions (in minutes from 12:00)
  // 15:00-16:00: 2 bars
  // 18:00-20:00: 3 bars
  const activityBars = [
    { top: 178, left: 36, width: 303 }, // 15:00-16:00 first
    { top: 203, left: 36, width: 303 }, // 15:00-16:00 second
    { top: 316, left: 36, width: 303 }, // 18:00-20:00 first
    { top: 341, left: 36, width: 303 }, // 18:00-20:00 second
    { top: 366, left: 36, width: 303 }, // 18:00-20:00 third
    { top: 391, left: 36, width: 303 }, // Additional bar
  ];

  return (
    <div className="bg-[#cec1bf] h-[493px] overflow-hidden relative rounded-[18px] w-full max-w-[356px]">
      {/* Activity bars */}
      {activityBars.map((bar, index) => (
        <div
          key={index}
          className="absolute bg-[#545b7f] h-[20px] rounded-[4px]"
          style={{
            top: `${bar.top}px`,
            left: `${bar.left}px`,
            width: `${bar.width}px`,
          }}
        />
      ))}

      {/* Timeline labels and lines */}
      <div className="absolute flex flex-col gap-[32px] left-[7px] top-[33px] w-[332px]">
        {timeLabels.map((time, index) => (
          <div key={index} className="flex gap-[2px] items-center w-full">
            <p className="text-[#8f92a9] text-[12px] tracking-[-0.72px] w-[26px]">
              {time}
            </p>
            <div className="h-0 flex-1 relative">
              <div className="absolute inset-[-1px_0_0_0]">
                <img
                  alt=""
                  className="block max-w-none w-full h-full"
                  src="/line4.svg"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom indicator line */}
      <div className="absolute left-[33px] top-[414px] w-[311px] h-[9px]">
        <img
          alt=""
          className="block max-w-none w-full h-full"
          src="/frame42.svg"
        />
      </div>
    </div>
  );
}

