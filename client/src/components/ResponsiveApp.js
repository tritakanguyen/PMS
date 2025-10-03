import { useEffect, useState } from "react";
import PodManagementApp from "./PodManagementApp";
import MobilePodManagementApp from "./mobile/MobilePodManagementApp";

const ResponsiveApp = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      // Consider mobile if width is less than 1024px (lg breakpoint)
      // This includes phones, tablets, and Galaxy Z Fold in folded state
      setIsMobile(window.innerWidth < 1024);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  return isMobile ? <MobilePodManagementApp /> : <PodManagementApp />;
};

export default ResponsiveApp;