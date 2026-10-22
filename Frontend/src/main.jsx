import ReactDOM from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import {
  QueryClient,
  QueryClientProvider
} from '@tanstack/react-query'
import { router } from './Routes/Router'
// import AuthProvider from './pages/Providers/AuthProvider'
// import { ThemeProvider } from '@mui/material/styles'

const queryClient = new QueryClient();

// const theme = createTheme({
//   status: {
//     primaryColor: '#0473EA',
//   },
// });

ReactDOM.createRoot(document.getElementById('root')).render(
  // <AuthProvider>
    <QueryClientProvider client={queryClient}>
      {/* <ThemeProvider theme={theme}> */}
        <RouterProvider router={router} />
      {/* </ThemeProvider> */}
    </QueryClientProvider>
  // </AuthProvider>
)
