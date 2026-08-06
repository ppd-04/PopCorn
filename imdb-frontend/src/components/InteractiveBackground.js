import React, { useEffect, useRef } from 'react';
// import './InteractiveBackground.css';

// Pre-defined star data for deterministic, dense starfield
const STARS_LAYER1 = [
  { top: '5%',  left: '12%', size: 'sm', color: '',       dur: '3.2s', delay: '0s',    minOp: 0.3, maxOp: 0.9 },
  { top: '9%',  left: '33%', size: 'xs', color: '',       dur: '4.5s', delay: '0.7s',  minOp: 0.2, maxOp: 0.7 },
  { top: '14%', left: '57%', size: 'md', color: 'gold',   dur: '3.8s', delay: '1.4s',  minOp: 0.4, maxOp: 1.0 },
  { top: '18%', left: '78%', size: 'sm', color: '',       dur: '5.1s', delay: '0.3s',  minOp: 0.2, maxOp: 0.8 },
  { top: '22%', left: '91%', size: 'xs', color: 'blue',   dur: '4.0s', delay: '2.0s',  minOp: 0.3, maxOp: 0.85 },
  { top: '27%', left: '6%',  size: 'lg', color: '',       dur: '6.2s', delay: '0.5s',  minOp: 0.3, maxOp: 0.9 },
  { top: '31%', left: '44%', size: 'sm', color: '',       dur: '4.8s', delay: '1.1s',  minOp: 0.2, maxOp: 0.75 },
  { top: '36%', left: '68%', size: 'xs', color: 'purple', dur: '3.5s', delay: '0.8s',  minOp: 0.3, maxOp: 1.0 },
  { top: '41%', left: '22%', size: 'md', color: '',       dur: '5.5s', delay: '1.7s',  minOp: 0.25, maxOp: 0.85 },
  { top: '46%', left: '87%', size: 'sm', color: 'gold',   dur: '4.2s', delay: '2.5s',  minOp: 0.4, maxOp: 1.0 },
  { top: '51%', left: '38%', size: 'xs', color: '',       dur: '3.9s', delay: '0.2s',  minOp: 0.2, maxOp: 0.7 },
  { top: '56%', left: '62%', size: 'sm', color: 'blue',   dur: '4.6s', delay: '1.3s',  minOp: 0.3, maxOp: 0.9 },
  { top: '61%', left: '15%', size: 'xs', color: '',       dur: '5.0s', delay: '0.6s',  minOp: 0.2, maxOp: 0.65 },
  { top: '67%', left: '49%', size: 'md', color: '',       dur: '4.3s', delay: '2.1s',  minOp: 0.3, maxOp: 0.85 },
  { top: '72%', left: '80%', size: 'sm', color: 'gold',   dur: '3.7s', delay: '0.9s',  minOp: 0.35, maxOp: 0.95 },
  { top: '76%', left: '26%', size: 'xs', color: 'purple', dur: '5.8s', delay: '1.6s',  minOp: 0.3, maxOp: 0.9 },
  { top: '82%', left: '71%', size: 'sm', color: '',       dur: '4.9s', delay: '0.4s',  minOp: 0.2, maxOp: 0.8 },
  { top: '87%', left: '8%',  size: 'md', color: 'blue',   dur: '6.0s', delay: '1.9s',  minOp: 0.3, maxOp: 0.9 },
  { top: '92%', left: '53%', size: 'xs', color: '',       dur: '3.4s', delay: '0.7s',  minOp: 0.2, maxOp: 0.7 },
  { top: '96%', left: '39%', size: 'sm', color: '',       dur: '4.1s', delay: '2.3s',  minOp: 0.25, maxOp: 0.75 },
];

const STARS_LAYER2 = [
  { top: '3%',  left: '48%', size: 'sm', color: '',       dur: '4.4s', delay: '0.4s',  minOp: 0.3, maxOp: 0.85 },
  { top: '8%',  left: '72%', size: 'xs', color: 'gold',   dur: '5.2s', delay: '1.2s',  minOp: 0.4, maxOp: 1.0 },
  { top: '13%', left: '19%', size: 'md', color: '',       dur: '3.6s', delay: '0.1s',  minOp: 0.25, maxOp: 0.8 },
  { top: '19%', left: '84%', size: 'sm', color: 'blue',   dur: '6.3s', delay: '2.2s',  minOp: 0.3, maxOp: 0.9 },
  { top: '24%', left: '36%', size: 'lg', color: '',       dur: '4.7s', delay: '0.8s',  minOp: 0.35, maxOp: 0.9 },
  { top: '29%', left: '61%', size: 'xs', color: 'purple', dur: '3.3s', delay: '1.5s',  minOp: 0.3, maxOp: 0.95 },
  { top: '34%', left: '3%',  size: 'sm', color: '',       dur: '5.6s', delay: '0.6s',  minOp: 0.2, maxOp: 0.75 },
  { top: '39%', left: '93%', size: 'xs', color: 'gold',   dur: '4.1s', delay: '1.8s',  minOp: 0.4, maxOp: 1.0 },
  { top: '44%', left: '55%', size: 'sm', color: '',       dur: '5.9s', delay: '0.3s',  minOp: 0.25, maxOp: 0.85 },
  { top: '49%', left: '29%', size: 'md', color: 'blue',   dur: '4.5s', delay: '2.7s',  minOp: 0.3, maxOp: 0.9 },
  { top: '54%', left: '77%', size: 'sm', color: '',       dur: '3.8s', delay: '0.9s',  minOp: 0.2, maxOp: 0.7 },
  { top: '59%', left: '41%', size: 'xs', color: 'purple', dur: '5.3s', delay: '1.4s',  minOp: 0.3, maxOp: 0.9 },
  { top: '64%', left: '88%', size: 'sm', color: '',       dur: '4.0s', delay: '0.5s',  minOp: 0.25, maxOp: 0.8 },
  { top: '69%', left: '13%', size: 'lg', color: 'gold',   dur: '6.1s', delay: '2.0s',  minOp: 0.4, maxOp: 1.0 },
  { top: '74%', left: '66%', size: 'xs', color: '',       dur: '3.7s', delay: '0.7s',  minOp: 0.2, maxOp: 0.75 },
  { top: '79%', left: '34%', size: 'sm', color: 'blue',   dur: '5.4s', delay: '1.6s',  minOp: 0.3, maxOp: 0.85 },
  { top: '84%', left: '95%', size: 'md', color: '',       dur: '4.8s', delay: '0.2s',  minOp: 0.25, maxOp: 0.8 },
  { top: '89%', left: '46%', size: 'xs', color: 'gold',   dur: '3.5s', delay: '2.4s',  minOp: 0.35, maxOp: 0.95 },
  { top: '94%', left: '22%', size: 'sm', color: '',       dur: '5.7s', delay: '1.0s',  minOp: 0.2, maxOp: 0.7 },
  { top: '98%', left: '58%', size: 'xs', color: 'purple', dur: '4.2s', delay: '0.8s',  minOp: 0.3, maxOp: 0.9 },
];

const STARS_LAYER3 = [
  { top: '6%',  left: '24%', size: 'xs', color: '',       dur: '5.1s', delay: '1.3s',  minOp: 0.2, maxOp: 0.7 },
  { top: '11%', left: '65%', size: 'sm', color: 'gold',   dur: '4.3s', delay: '0.6s',  minOp: 0.4, maxOp: 1.0 },
  { top: '16%', left: '43%', size: 'md', color: 'blue',   dur: '6.5s', delay: '1.9s',  minOp: 0.3, maxOp: 0.9 },
  { top: '21%', left: '8%',  size: 'xs', color: '',       dur: '3.9s', delay: '0.2s',  minOp: 0.2, maxOp: 0.65 },
  { top: '26%', left: '96%', size: 'sm', color: 'purple', dur: '5.5s', delay: '2.6s',  minOp: 0.3, maxOp: 0.9 },
  { top: '32%', left: '51%', size: 'lg', color: '',       dur: '4.0s', delay: '0.8s',  minOp: 0.35, maxOp: 0.85 },
  { top: '37%', left: '74%', size: 'xs', color: 'gold',   dur: '5.8s', delay: '1.5s',  minOp: 0.4, maxOp: 1.0 },
  { top: '43%', left: '17%', size: 'sm', color: '',       dur: '3.6s', delay: '0.4s',  minOp: 0.25, maxOp: 0.8 },
  { top: '48%', left: '86%', size: 'md', color: 'blue',   dur: '4.9s', delay: '2.1s',  minOp: 0.3, maxOp: 0.9 },
  { top: '53%', left: '31%', size: 'xs', color: '',       dur: '5.2s', delay: '0.7s',  minOp: 0.2, maxOp: 0.7 },
  { top: '58%', left: '59%', size: 'sm', color: 'purple', dur: '4.5s', delay: '1.7s',  minOp: 0.3, maxOp: 0.85 },
  { top: '63%', left: '2%',  size: 'xs', color: 'gold',   dur: '3.7s', delay: '0.5s',  minOp: 0.35, maxOp: 0.95 },
  { top: '68%', left: '47%', size: 'sm', color: '',       dur: '6.0s', delay: '2.3s',  minOp: 0.2, maxOp: 0.75 },
  { top: '73%', left: '82%', size: 'lg', color: 'blue',   dur: '4.6s', delay: '1.0s',  minOp: 0.3, maxOp: 0.9 },
  { top: '78%', left: '28%', size: 'xs', color: '',       dur: '5.4s', delay: '0.3s',  minOp: 0.2, maxOp: 0.65 },
  { top: '83%', left: '72%', size: 'sm', color: 'gold',   dur: '3.8s', delay: '1.8s',  minOp: 0.4, maxOp: 1.0 },
  { top: '88%', left: '15%', size: 'md', color: 'purple', dur: '5.7s', delay: '0.9s',  minOp: 0.3, maxOp: 0.85 },
  { top: '93%', left: '63%', size: 'xs', color: '',       dur: '4.1s', delay: '2.0s',  minOp: 0.2, maxOp: 0.7 },
  { top: '97%', left: '37%', size: 'sm', color: 'blue',   dur: '5.0s', delay: '0.6s',  minOp: 0.3, maxOp: 0.9 },
  { top: '2%',  left: '89%', size: 'xs', color: '',       dur: '4.7s', delay: '1.2s',  minOp: 0.25, maxOp: 0.8 },
];

function StarField({ stars }) {
  return stars.map((s, i) => (
    <span
      key={i}
      className={`ibg-particle ibg-star ${s.size}${s.color ? ' ' + s.color : ''}`}
      style={{
        top: s.top,
        left: s.left,
        '--dur': s.dur,
        '--delay': s.delay,
        '--min-op': s.minOp,
        '--max-op': s.maxOp,
      }}
    />
  ));
}

const InteractiveBackground = () => {
  const layer1Ref = useRef(null);
  const layer2Ref = useRef(null);
  const layer3Ref = useRef(null);

  useEffect(() => {
    let rafId;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      targetX = (e.clientX / innerWidth - 0.5) * 2;
      targetY = (e.clientY / innerHeight - 0.5) * 2;
    };

    const animate = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      if (layer1Ref.current) {
        layer1Ref.current.style.transform = `translate(${currentX * -22}px, ${currentY * -22}px)`;
      }
      if (layer2Ref.current) {
        layer2Ref.current.style.transform = `translate(${currentX * -11}px, ${currentY * -11}px)`;
      }
      if (layer3Ref.current) {
        layer3Ref.current.style.transform = `translate(${currentX * -4}px, ${currentY * -4}px)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMouseMove);
    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="ibg-root" aria-hidden="true">
      {/* Nebula mesh */}
      <div className="ibg-mesh" />

      {/* Shooting stars (static layer, no parallax) */}
      <div className="ibg-shoot-wrap">
        <div className="ibg-shoot s1" />
        <div className="ibg-shoot s2" />
        <div className="ibg-shoot s3" />
        <div className="ibg-shoot s4" />
        <div className="ibg-shoot s5" />
      </div>

      {/* Layer 1 — deepest (most parallax shift) */}
      <div className="ibg-layer" ref={layer1Ref}>
        <StarField stars={STARS_LAYER1} />
        {/* Big blur glows */}
        <span className="ibg-particle ibg-dot s5 blur"        style={{ top: '8%',  left: '52%' }} />
        <span className="ibg-particle ibg-dot s5 purple-blur" style={{ top: '70%', left: '15%' }} />
        <span className="ibg-particle ibg-dot s5 blue-blur"   style={{ top: '40%', left: '88%' }} />
        {/* Sparkles */}
        <span className="ibg-particle ibg-flower" style={{ top: '14%', left: '18%' }} />
        <span className="ibg-particle ibg-flower" style={{ top: '79%', left: '12%', animationDelay: '2s' }} />
      </div>

      {/* Layer 2 — mid parallax */}
      <div className="ibg-layer" ref={layer2Ref}>
        <StarField stars={STARS_LAYER2} />
        <span className="ibg-particle ibg-dot s4 blur"        style={{ top: '32%', left: '5%',  animationDelay: '4s' }} />
        <span className="ibg-particle ibg-dot s4 purple-blur" style={{ top: '56%', left: '72%', animationDelay: '1s' }} />
        <span className="ibg-particle ibg-dot s4 blue-blur"   style={{ top: '18%', left: '40%', animationDelay: '7s' }} />
        <span className="ibg-particle ibg-flower" style={{ top: '44%', left: '83%', animationDelay: '6s' }} />
        <span className="ibg-particle ibg-dot s3" style={{ top: '72%', left: '42%', animationDelay: '2s' }} />
      </div>

      {/* Layer 3 — closest (least parallax shift) */}
      <div className="ibg-layer" ref={layer3Ref}>
        <StarField stars={STARS_LAYER3} />
        <span className="ibg-particle ibg-dot s5 blur"        style={{ top: '90%', left: '76%', animationDelay: '2s' }} />
        <span className="ibg-particle ibg-dot s5 purple-blur" style={{ top: '52%', left: '90%', animationDelay: '5s' }} />
        <span className="ibg-particle ibg-flower" style={{ top: '60%', left: '50%', animationDelay: '9s' }} />
        <span className="ibg-particle ibg-dot s3" style={{ top: '24%', left: '95%', animationDelay: '3s' }} />
      </div>
    </div>
  );
};

export default InteractiveBackground;
