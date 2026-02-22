import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../lib/supabase";
import SkillsLogo from "../assets/SkillsLogo";
import SearchIcon from "../assets/SearchIcon";

type Props = NativeStackScreenProps<RootStackParamList, "Skills">;

type SkillRow = {
  id: number;
  name: string;
  category: string;
};

export default function SkillsScreen({ navigation, route }: Props) {
  const { userId } = route.params;

  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const normalized = query.trim().toLowerCase();

  const CATEGORY_TITLES: Record<string, string> = {
    PROGRAMMING: 'ПРОГРАММИРОВАНИЕ',
    DESIGN: 'ДИЗАЙН',
    MANAGEMENT: 'МЕНЕДЖМЕНТ',
  };

  const groups = useMemo(() => {
    const grouped: Record<string, SkillRow[]> = {};
    skills.forEach((s) => {
      if (normalized && !s.name.toLowerCase().includes(normalized)) return;
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    });
    const result = Object.entries(grouped)
      .sort(([a], [b]) => {
        const order = ['PROGRAMMING', 'DESIGN', 'MANAGEMENT'];
        return order.indexOf(a) - order.indexOf(b);
      })
      .map(([cat, items]) => ({
        title: CATEGORY_TITLES[cat] || cat,
        items,
      }));

    // Add "МОИ" category if user has selected skills
    if (selected.length > 0) {
      const mySkills = skills.filter((s) => selected.includes(s.id));
      if (mySkills.length > 0) {
        result.unshift({
          title: 'МОИ',
          items: mySkills,
        });
      }
    }

    return result;
  }, [skills, normalized, selected]);

  const toggle = (skillId: number) => {
    setSelected((prev) => (prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]));
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [{ data: skillsData, error: skillsError }, { data: userSkillsData, error: userSkillsError }] =
          await Promise.all([
            supabase.from("skills").select("id,name,category").order("name", { ascending: true }),
            supabase.from("user_skills").select("skill_id").eq("user_id", userId),
          ]);

        if (skillsError) throw skillsError;
        if (userSkillsError) throw userSkillsError;

        if (!isMounted) return;

        setSkills((skillsData ?? []) as SkillRow[]);
        setSelected((userSkillsData ?? []).map((r: { skill_id: number }) => r.skill_id));
      } catch (e) {
        Alert.alert("Ошибка", e instanceof Error ? e.message : "Ошибка при загрузке навыков");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const onSave = async () => {
    setLoading(true);
    try {
      const { error: deleteError } = await supabase.from("user_skills").delete().eq("user_id", userId);
      if (deleteError) throw deleteError;

      if (selected.length > 0) {
        const rows = selected.map((skillId) => ({ user_id: userId, skill_id: skillId }));
        const { error: insertError } = await supabase.from("user_skills").insert(rows);
        if (insertError) throw insertError;
      }

      Alert.alert("Готово", "Навыки сохранены");
      navigation.replace("Profile");
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Ошибка при сохранении навыков");
    } finally {
      setLoading(false);
    }
  };

  const renderSkills = (items: SkillRow[]) => {
    return (
      <View style={styles.skillsContainer}>
        {items.map((item) => {
          const isSelected = selected.includes(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => toggle(item.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[styles.skillBtn, isSelected ? styles.skillBtnSelected : null]}
            >
              <Text style={[styles.skillText, isSelected ? styles.skillTextSelected : null]} numberOfLines={1}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.titleWrap}>
        <SkillsLogo width="92%" height={140} />
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

      <View style={styles.groupsWrap}>
        {groups.map((g) => (
          <View key={g.title} style={styles.groupWrap}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            {renderSkills(g.items)}
          </View>
        ))}
      </View>

      <View style={styles.bottom}>
        <View style={styles.bottomRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>НАЗАД</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={loading} onPress={onSave} style={[styles.primaryBtn, loading && styles.disabled]}>
            <Text style={styles.primaryText}>СОХРАНИТЬ</Text>
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
  titleWrap: {
    alignItems: "center",
    marginBottom: 10,
  },
  help: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#000",
    marginBottom: 10,
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
  groupsWrap: {
    flex: 1,
    marginTop: 12,
    gap: 14,
    overflow: "hidden",
  },
  groupWrap: {
    gap: 8,
  },
  skillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  skillBtn: {
    height: 40,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
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
