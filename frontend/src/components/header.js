import MenuBar from "./MenuBar";
import ModeToggleButton from "./buttons/ModeToggleButton";
import Logo from "./Logo";

const Header = () => {
  return (
    <header className="bg-[#05A0D1] text-white p-1">
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-2">
          <Logo width={24} height={24} />
          <MenuBar />
        </div>
        <h1 className="text-base font-bold absolute left-1/2 transform -translate-x-1/2">Pod Management System</h1>
        <ModeToggleButton />
      </div>
    </header>
  );
};

export default Header;
