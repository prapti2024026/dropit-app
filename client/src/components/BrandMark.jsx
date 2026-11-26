import { Grab } from "lucide-react";

// DropIt logo: a grabbing hand on the coral → violet → aqua gradient (send → history → receive)
const BrandMark = ({ size = 36 }) => (
  <span
    className="brand-mark"
    style={{ width: size, height: size, borderRadius: size * 0.32 }}
    aria-hidden="true"
  >
    <Grab size={size * 0.56} strokeWidth={2.2} />
  </span>
);

export default BrandMark;
