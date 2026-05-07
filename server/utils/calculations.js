const RATES_1ON1 = {
  national: { primary: 50, secondary: 65 },
  cambridge: { primary: 65, secondary: 75 }
};

const RATES_GROUP = {
  national: { primary: 19.17, secondary: 25 },
  cambridge: { primary: 25, secondary: 29.17 }
};

function getHourlyRate(age, syllabus, classType) {
  const isSecondary = age >= 13;
  const isCambridge = syllabus === 'Cambridge';
  const level = isSecondary ? 'secondary' : 'primary';
  const syllabusKey = isCambridge ? 'cambridge' : 'national';
  return classType === '1on1'
    ? RATES_1ON1[syllabusKey][level]
    : RATES_GROUP[syllabusKey][level];
}

function getCollaborationRate(equivalentCount, isCambridge) {
  if (isCambridge) {
    if (equivalentCount <= 1) return 0;
    if (equivalentCount <= 4) return 0.15;
    return 0.20;
  } else {
    if (equivalentCount <= 4) return 0;
    if (equivalentCount <= 9) return 0.15;
    return 0.20;
  }
}

function calcEquivalentCount(students) {
  return students.reduce((sum, s) => sum + (s.class_type === '1on1' ? 3 : 1), 0);
}

function calculateCollaborationFee(teacherStudents, studentTuitionFees) {
  const national = teacherStudents.filter(s => s.syllabus !== 'Cambridge');
  const cambridge = teacherStudents.filter(s => s.syllabus === 'Cambridge');

  const nationalRate = getCollaborationRate(calcEquivalentCount(national), false);
  const cambridgeRate = getCollaborationRate(calcEquivalentCount(cambridge), true);

  return teacherStudents.reduce((total, s) => {
    const fee = studentTuitionFees[s.id] || 0;
    const rate = s.syllabus === 'Cambridge' ? cambridgeRate : nationalRate;
    return total + fee * rate;
  }, 0);
}

module.exports = { getHourlyRate, getCollaborationRate, calculateCollaborationFee };
