import { RouterProvider, createBrowserRouter } from "react-router-dom";
import SplashScreen from "./pages/SplashScreen";
import OnboardingScreen from "./pages/OnboardingScreen";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ErrorPage from "./pages/ErrorPage";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyCode from "./pages/VerifyCode";
import ResetPassword from "./pages/ResetPassword";
import MainNavigation from "./components/MainNavigation";
import ChatList from "./chatAppPages/ChatList";
import CallList from "./chatAppPages/CallList";
import UpdateList from "./chatAppPages/UpdateList";
import Settings from "./chatAppPages/Settings";
import UserProfile from "./chatAppPages/UserProfile";
import AddUser from "./chatAppPages/AddUser";
import ChatWindow from "./chatAppPages/ChatWindow";
import Request from "./chatAppPages/Request";
import FriendsProfile from "./chatAppPages/FriendsProfile";

const router = createBrowserRouter([
  {
    path: "/",
    element: <SplashScreen />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/onboarding",
    element: <OnboardingScreen />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/signup",
    element: <SignupPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/verify-code",
    element: <VerifyCode />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/main-navigation",
    element: <MainNavigation />,
    errorElement: <ErrorPage />,
    children: [
      { path: "chats", element: <ChatList /> },
      { path: "calls", element: <CallList /> },
      { path: "updates", element: <UpdateList /> },
      { path: "settings", element: <Settings /> },
      { path: "user-profile", element: <UserProfile /> },
      { path: "add-user", element: <AddUser /> },
      { path: "requests", element: <Request /> },
    ],
  },
  {
    path: "/chat/:friendId",
    element: <ChatWindow />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/friends-profile",
    element: <FriendsProfile />,
    errorElement: <ErrorPage />,
  },
]);

const App: React.FC = () => {
  return <RouterProvider router={router} />;
};

export default App;
