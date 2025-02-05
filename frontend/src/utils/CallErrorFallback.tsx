import { Button, Typography, Box } from "@mui/material";

interface CallErrorFallbackProps {
  resetErrorBoundary?: () => void;
}

const CallErrorFallback: React.FC<CallErrorFallbackProps> = ({
  resetErrorBoundary,
}) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="100vh"
      textAlign="center"
      p={2}
    >
      <Typography variant="h5" color="error" gutterBottom>
        Oops! Something went wrong with the call.
      </Typography>
      <Typography variant="body1">Please try again.</Typography>
      <Button
        variant="contained"
        color="primary"
        sx={{ mt: 2 }}
        onClick={resetErrorBoundary || (() => window.location.reload())}
      >
        Retry
      </Button>
    </Box>
  );
};

export default CallErrorFallback;
