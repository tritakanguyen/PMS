import MenuBar from "../MenuBar";
import ModeToggleButton from "../buttons/ModeToggleButton";

const MobileHeader = () => {
  return (
    <header className="bg-[#05A0D1] text-white p-3 safe-area-top">
      <div className="flex items-center justify-between relative">
        <MenuBar isMobile={true} />
        <h1 className="text-lg font-bold absolute left-1/2 transform -translate-x-1/2">Pod Management</h1>
        <ModeToggleButton isMobile={true} />
      </div>
    </header>
  );
};

export default MobileHeader;