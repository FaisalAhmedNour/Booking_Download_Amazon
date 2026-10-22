import { Outlet, NavLink } from "react-router-dom";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";

const Main = () => {
    return (
        <div className="max-w-[1600px] mx-auto min-h-screen flex flex-col p-2">
            {/* Top Module Switcher Navigation */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) =>
                            `flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                isActive
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`
                        }
                    >
                        <AssignmentTurnedInIcon sx={{ fontSize: 16 }} />
                        <span>Amazon Booking Download</span>
                    </NavLink>

                    <NavLink
                        to="/builder"
                        className={({ isActive }) =>
                            `flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                isActive
                                    ? "bg-indigo-600 text-white shadow-sm"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`
                        }
                    >
                        <AutoAwesomeIcon sx={{ fontSize: 16 }} />
                        <span>Excel Booking Builder</span>
                    </NavLink>

                    <NavLink
                        to="/vms-status"
                        className={({ isActive }) =>
                            `flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                isActive
                                    ? "bg-teal-700 text-white shadow-sm"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`
                        }
                    >
                        <CloudDownloadIcon sx={{ fontSize: 16 }} />
                        <span>VMS Booking Status</span>
                    </NavLink>
                </div>

                <div className="text-xs text-gray-400 font-medium">
                    Century VMS &bull; Amazon Correction Module
                </div>
            </div>

            <div className="flex-1">
                <Outlet />
            </div>
        </div>
    );
};

export default Main;
