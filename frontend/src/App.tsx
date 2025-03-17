import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { UnauthorizedErrorHandler } from "./utils/UnauthorizedErrorHandler ";
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
import CallInterface from "./calls/CallInterface";
import IncomingCallModal from "./calls/IncomingCallModal";
import { useCall } from "./contexts/CallContext";
import { ErrorBoundary } from "./utils/ErrorBoundary";
import CallErrorFallback from "./utils/CallErrorFallback";

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
    path: "/friends-profile/:friendId",
    element: <FriendsProfile />,
    errorElement: <ErrorPage />,
  },
]);

const App: React.FC = () => {
  const { callState } = useCall();

  return (
    <>
      <RouterProvider router={router} />
      <UnauthorizedErrorHandler />
      <IncomingCallModal />
      {callState.currentCall.id && (
        <ErrorBoundary fallback={<CallErrorFallback />}>
          <CallInterface />
        </ErrorBoundary>
      )}
    </>
  );
};

export default App;
