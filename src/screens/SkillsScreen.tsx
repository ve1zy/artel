import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../lib/supabase";
import SkillsLogo from "../assets/SkillsLogo";
import SearchIcon from "../assets/SearchIcon";

type Props = NativeStackScreenProps<RootStackParamList, "Skills">;

const PROGRAMMING = [
  "C#",
  "Python",
  "Docker",
  "Git",
  "MongoDB",
  "C++",
  "Java",
  "MySQL",
  "React",
  "Django",
];

const DESIGN = ["UX/UI", "Photoshop", "Blender", "Figma"];

const MANAGEMENT = ["Trello", "Miro", "Project management", "Notion"];

export default function SkillsScreen({ navigation, route }: Props) {
  const { userId } = route.params;

  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const normalized = query.trim().toLowerCase();

  const filterItems = (items: string[]) => {
    if (!normalized) return items;
    return items.filter((x) => x.toLowerCase().includes(normalized));
  };

  const groups = useMemo(() => {
    const p = filterItems(PROGRAMMING);
    const d = filterItems(DESIGN);
    const m = filterItems(MANAGEMENT);

    return [
      { title: "ПРОГРАММИРОВАНИЕ", columns: 4 as const, items: p },
      { title: "ДИЗАЙН", columns: 4 as const, items: d },
      { title: "МЕНЕДЖМЕНТ", columns: 4 as const, items: m },
    ].filter((g) => g.items.length > 0);
  }, [normalized]);

  const toggle = (skill: string) => {
    setSelected((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  };

  const onSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ 
          id: userId, 
          skills: selected,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      Alert.alert("Готово", "Навыки сохранены");
      navigation.replace("Profile");
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Ошибка при сохранении навыков");
    } finally {
      setLoading(false);
    }
  };

  const renderSkills = (items: string[]) => {
    return (
      <View style={styles.skillsContainer}>
        {items.map((item) => {
          const isSelected = selected.includes(item);
          return (
            <TouchableOpacity
              key={item}
              onPress={() => toggle(item)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[styles.skillBtn, isSelected ? styles.skillBtnSelected : null]}
            >
              <Text style={[styles.skillText, isSelected ? styles.skillTextSelected : null]} numberOfLines={1}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.titleWrap}>
          <SkillsLogo width="92%" height={160} />
        </View>

        <Text style={styles.help}>ВЫБЕРИ НАВЫКИ, КОТОРЫМИ ТЫ ВЛАДЕЕШЬ</Text>

        <View style={styles.searchWrap}>
          <SearchIcon />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="поиск"
            style={styles.search}
            placeholderTextColor="#999"
          />
        </View>

        <View style={{ gap: 22, marginTop: 14 }}>
          {groups.map((g) => (
            <View key={g.title} style={{ gap: 10 }}>
              <Text style={styles.groupTitle}>{g.title}</Text>
              {renderSkills(g.items)}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.bottomRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>НАЗАД</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={loading} onPress={onSave} style={[styles.primaryBtn, loading && styles.disabled]}>
            <Text style={styles.primaryText}>
              {selected.length > 0 ? "ЗАВЕРШИТЬ" : "ПОКА НЕ ХОЧУ"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressRow}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.progressSegment, i === 2 ? styles.progressActive : styles.progressInactive]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  titleWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  help: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#000",
    marginBottom: 14,
  },
  searchWrap: {
    borderWidth: 1,
    borderColor: "#000",
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  search: {
    fontSize: 14,
    color: "#000",
    flex: 1,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#000",
  },
  skillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  skillBtnSelected: {
    backgroundColor: "#000",
  },
  skillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#000",
  },
  skillTextSelected: {
    color: "#fff",
  },
  bottom: {
    paddingBottom: 24,
  },
  bottomRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  primaryBtn: {
    flex: 1,
    height: 56,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  secondaryBtn: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  disabled: {
    opacity: 0.6,
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
  },
  progressSegment: {
    flex: 1,
    height: 4,
  },
  progressActive: {
    backgroundColor: "#000",
  },
  progressInactive: {
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "transparent",
  },
});
