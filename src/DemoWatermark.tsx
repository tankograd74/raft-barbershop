/** Full-viewport repeating DEMO watermark + corner badge. */
export default function DemoWatermark() {
  return (
    <>
      <div className="demo-watermark" aria-hidden="true">
        <div className="demo-watermark__tile">
          {Array.from({ length: 48 }).map((_, i) => (
            <span key={i} className="demo-watermark__word">
              DEMO
            </span>
          ))}
        </div>
      </div>
      <div className="demo-badge" aria-hidden="true">
        DEMO
      </div>
    </>
  );
}
