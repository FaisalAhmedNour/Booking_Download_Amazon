import { createMemoryRouter } from "react-router-dom";
import Main from "../Layouts/Main/Main";

// Pages are rendered by Main and kept mounted (see Main.jsx); routes only drive
// which one is visible and the active nav link.
export const router = createMemoryRouter([
    {
        path: "/",
        element: <Main />,
        children: [
            { path: "/", element: null },
            { path: "/vms-status", element: null },
        ]
    }
]);
