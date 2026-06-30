import { router } from "expo-router";
import { LockKeyhole, LogIn } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BBA } from "@bba/config";
import { useBbaStore } from "@bba/lib";

const getLoginErrorMessage = (caught: unknown) => {
  if (
    caught instanceof Error &&
    caught.message.toLowerCase().includes("invalid login credentials")
  ) {
    return "Email ou senha invalidos. Contas demo usam a senha Teste123!.";
  }

  return caught instanceof Error ? caught.message : "Nao foi possivel entrar.";
};

export default function LoginScreen() {
  const signIn = useBbaStore((state) => state.signIn);
  const [email, setEmail] = useState("carlos@carlosmendes.com.br");
  const [password, setPassword] = useState("Teste123!");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    setError("");

    try {
      await signIn(email, password);
      router.replace("/dashboard");
    } catch (caught) {
      setError(getLoginErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>BBA App</Text>
        <Text style={styles.title}>Entrar no portal</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="E-mail"
          style={styles.input}
          value={email}
        />
        <TextInput
          onChangeText={setPassword}
          placeholder="Senha"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        <Pressable disabled={busy} onPress={handleLogin} style={styles.button}>
          {busy ? <LockKeyhole color={BBA.white} size={18} /> : <LogIn color={BBA.white} size={18} />}
          <Text style={styles.buttonText}>{busy ? "Entrando" : "Entrar"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: BBA.paper,
    flex: 1,
    justifyContent: "center",
    padding: 20
  },
  card: {
    backgroundColor: BBA.white,
    borderColor: BBA.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 20
  },
  brand: {
    color: BBA.gold,
    fontSize: 13,
    fontWeight: "700"
  },
  title: {
    color: BBA.navy,
    fontSize: 24,
    fontWeight: "700"
  },
  error: {
    backgroundColor: "#fff1f0",
    borderColor: "#ffc7c2",
    borderRadius: 8,
    borderWidth: 1,
    color: "#a62920",
    padding: 10
  },
  input: {
    backgroundColor: "#fdfcf8",
    borderColor: BBA.line,
    borderRadius: 8,
    borderWidth: 1,
    color: BBA.ink,
    minHeight: 46,
    paddingHorizontal: 12
  },
  button: {
    alignItems: "center",
    backgroundColor: BBA.navy,
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46
  },
  buttonText: {
    color: BBA.white,
    fontWeight: "700"
  }
});
