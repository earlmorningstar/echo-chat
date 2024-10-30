import { RouterProvider, createBrowserRouter } from "react-router-dom";
import SplashScreen from "./pages/SplashScreen";
import OnboardingScreen from "./pages/OnboardingScreen";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
// import RootLayout from "./pages/RootLayout";
// import ErrorPage from "./pages/ErrorPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <SplashScreen />,
  },
  {
    path: "/onboarding",
    element: <OnboardingScreen />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/signup",
    element: <SignupPage />,
  },
  //   {
  //     path: '/home',
  //     element: <RootLayout />, // Main layout component of the app
  //     errorElement: <ErrorPage />,
  //     children: [
  //         // Define child routes here if needed
  //     ],
  // },
]);

const App: React.FC = () => {
  return <RouterProvider router={router} />;
};

export default App;
