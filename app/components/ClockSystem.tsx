// "use client";
// import { useState, useEffect } from "react";

// interface ClockProps {
//   onClockIn: (status: boolean) => void;
//   isClockedIn: boolean;
// }

// export default function ClockSystem({ onClockIn, isClockedIn }: ClockProps) {
//   const [time, setTime] = useState(new Date());

//   useEffect(() => {
//     const timer = setInterval(() => setTime(new Date()), 1000);
//     return () => clearInterval(timer);
//   }, []);

//   // Format the time as 12-hour (01:23:45)
//   const timeString = time.toLocaleTimeString([], { 
//     hour12: true, 
//     hour: '2-digit', 
//     minute: '2-digit', 
//     second: '2-digit' 
//   }).split(' ')[0]; // This gets just the digits

//   // Get the AM/PM part
//   const period = time.toLocaleTimeString([], { 
//     hour12: true, 
//     hour: '2-digit' 
//   }).slice(-2);

//   // Format the date (e.g., Tuesday, January 27)
//   const dateString = time.toLocaleDateString(undefined, { 
//     weekday: 'long', 
//     month: 'long', 
//     day: 'numeric' 
//   });

//   return (
//     <div className={isClockedIn ? "glass-card fade-in" : "landing-card fade-in"}>
//       <div className="hero-clock-label">SYSTEM TIME • PHT</div>
      
//       <div className="hero-clock-row">
//         {/* The main clock digits */}
//         <div id="landing-time-digits">{timeString}</div>
        
//         {/* The AM/PM indicator */}
//         <div id="landing-time-period" style={{ marginLeft: '10px' }}>
//           {period}
//         </div>
//       </div>

//       {/* The full date display */}
//       <div className="hero-date-display">
//         {dateString}
//       </div>

//       <button 
//         onClick={() => onClockIn(!isClockedIn)}
//         className={`btn-action ${isClockedIn ? "btn-urgent" : "btn-go"}`}
//       >
//         <span className="btn-label">
//           {isClockedIn ? "CLOCK OUT" : "CLOCK IN"}
//         </span>
//       </button>
//     </div>
//   );
// }