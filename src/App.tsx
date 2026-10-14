import * as React from "react";
import "./App.css";
import "./components/notch/notch.css";
import { Notch } from "./components/notch";

function App() {
  const [reMorph, setReMorph] = React.useState(false);

  return (
    <div className="root-container relative m-2 bg-white rounded-lg">
      {/*<div className="notch-bar-2 w-40 rounded-b-md"></div>*/}
      <div className="absolute top-0">
        <Notch
          speed={0.7}
          ease={{ stiffness: 300, damping: 36, mass: 1, alpha: 0.81 }}
          borderRadius={{
            pill: { tl: 0, tr: 0, br: 10, bl: 10 },
            expanded: { tl: 0, tr: 0, br: 12, bl: 12 },
          }}
          pill={
            <div
              className="w-40 text-center"
              style={{ padding: "8px 16px", fontSize: 12, fontWeight: 500 }}
            >
              Hello Notch
            </div>
          }
          className="notch-bar-2"
          style={
            {
              "--notch-ic-width": "6px",
              "--notch-bar-color": "#000",
            } as React.CSSProperties
          }
          contentDelay={300}
          trigger="click"
        >
          <div
            style={{
              padding: "16px 18px",
              fontSize: 13,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              width: reMorph ? 320 : 220,
            }}
          >
            <div style={{ fontWeight: 600 }}>NotchV2</div>
            <div style={{ opacity: 0.6 }}>counter: 1</div>
            <div style={{ opacity: 0.4, fontSize: 11 }}>
              {reMorph
                ? "wide mode — click to shrink"
                : "narrow mode — click to grow"}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setReMorph((p) => !p);
              }}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: "#fff",
                padding: "6px 10px",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
                alignSelf: "flex-start",
              }}
            >
              toggle width
            </button>
          </div>
        </Notch>
      </div>
    </div>
  );
}

export default App;
