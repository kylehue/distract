<template>
   <NLayout class="flex justify-center w-full h-full">
      <NLayoutContent class="w-full h-full">
         <NScrollbar class="h-full">
            <NSpace vertical size="large" class="p-6">
               <div class="flex justify-between items-center">
                  <NH1 class="m-0!">Privacy Policy</NH1>

                  <RouterLink to="/" class="link">
                     Go back
                  </RouterLink>
               </div>

               <NDivider />

               <section>
                  <NH2>1. Introduction</NH2>
                  <NP>
                     This Privacy Policy explains how the Distract system
                     collects, processes, and stores information during the use
                     of its monitoring platform designed to support fairness and
                     academic integrity in computer-based assessments. The
                     system assists instructors and proctors by analyzing
                     behavioral patterns through real-time monitoring during
                     assessment sessions.
                  </NP>

                  <NP>
                     By participating in a computer-based assessment session
                     using this system, users acknowledge that behavioral data
                     may be analyzed to detect irregular patterns that may
                     indicate potential academic misconduct.
                  </NP>
               </section>

               <section>
                  <NH2>2. Information Collected</NH2>

                  <NH3>Behavioral Data</NH3>
                  <NUl>
                     <NLi>Face detection and face bounds</NLi>
                     <NLi>Facial landmark coordinates</NLi>
                     <NLi>Eye gaze direction (x, y)</NLi>
                     <NLi>Head pose orientation (yaw, pitch, roll)</NLi>
                     <NLi>Hand coordinates and hand positions</NLi>
                     <NLi>Number of detected faces</NLi>
                     <NLi>Number of detected hands</NLi>
                     <NLi>Mobile phone presence within the frame</NLi>
                  </NUl>

                  <NH3>Monitoring Metrics</NH3>
                  <NUl>
                     <NLi>Integrity scores ranging from 0 to 1</NLi>
                     <NLi>
                        Behavioral warning levels (Low, Moderate, Severe)
                     </NLi>
                     <NLi>Anomaly detection scores</NLi>
                     <NLi>Feature importance indicators</NLi>
                  </NUl>

                  <NH3>Session Data</NH3>
                  <NUl>
                     <NLi>User identifiers associated with the session</NLi>
                     <NLi>Room identifiers</NLi>
                     <NLi>Timestamps of events</NLi>
                     <NLi>Monitoring logs and warning events</NLi>
                  </NUl>
               </section>

               <section>
                  <NH2>3. Use of Collected Information</NH2>
                  <NP>The collected information is used to:</NP>

                  <NUl>
                     <NLi>
                        Detect irregular behavioral patterns during
                        computer-based assessments
                     </NLi>
                     <NLi>
                        Generate integrity scores and warning indicators
                     </NLi>
                     <NLi>
                        Assist instructors and proctors in monitoring assessment
                        sessions
                     </NLi>
                     <NLi>Provide behavioral analytics for review</NLi>
                     <NLi>
                        Improve monitoring accuracy and system performance
                     </NLi>
                  </NUl>

                  <NP>
                     The system does not automatically label students as
                     cheating. Detected events serve as indicators to support
                     instructor or proctor decision-making.
                  </NP>
               </section>

               <section>
                  <NH2>4. Real-Time Processing and Data Minimization</NH2>

                  <NP>
                     To protect user privacy, most behavioral data is processed
                     locally on the student device. The webcam video stream is
                     analyzed in real time using computer vision and machine
                     learning models.
                  </NP>

                  <NP>
                     Continuous video recordings are not stored. Only
                     information related to flagged events may be transmitted to
                     the server, including integrity scores, warning levels,
                     timestamps, and supporting evidence when moderate or severe
                     irregularities occur.
                  </NP>
               </section>

               <section>
                  <NH2>5. Data Storage</NH2>

                  <NP>
                     The system may store the following monitoring records:
                  </NP>

                  <NUl>
                     <NLi>Integrity scores</NLi>
                     <NLi>Behavioral warning levels</NLi>
                     <NLi>Event timestamps</NLi>
                     <NLi>Supporting evidence from flagged events</NLi>
                  </NUl>
               </section>

               <section>
                  <NH2>6. Data Access</NH2>

                  <NP>Monitoring data may be accessed by:</NP>

                  <NUl>
                     <NLi>
                        Instructors or proctors supervising the computer-based
                        assessment
                     </NLi>
                     <NLi>
                        Authorized system administrators responsible for
                        maintaining the platform
                     </NLi>
                  </NUl>

                  <NP>
                     Access to monitoring data is restricted to authorized
                     personnel responsible for managing or supervising
                     assessment sessions.
                  </NP>
               </section>

               <section>
                  <NH2>7. Human Oversight</NH2>

                  <NP>
                     The system functions only as a decision-support tool.
                     Integrity scores and warning levels do not represent
                     definitive proof of academic misconduct. Final decisions
                     remain under the authority of instructors or authorized
                     academic personnel.
                  </NP>
               </section>

               <section>
                  <NH2>8. System Limitations</NH2>

                  <NP>The system does not include:</NP>

                  <NUl>
                     <NLi>Facial recognition</NLi>
                     <NLi>Identity verification</NLi>
                     <NLi>Keystroke logging</NLi>
                     <NLi>Continuous video recording</NLi>
                     <NLi>Biometric identification</NLi>
                  </NUl>

                  <NP>
                     Monitoring is limited to activity visible within the webcam
                     frame and cannot observe behavior outside the camera's
                     field of view.
                  </NP>
               </section>

               <section>
                  <NH2>9. Consent</NH2>

                  <NP>
                     By joining a computer-based assessment session and
                     accepting the privacy notice, users acknowledge that
                     behavioral monitoring and analysis will occur during the
                     assessment.
                  </NP>

                  <NP>
                     Users who do not agree to this policy should not
                     participate in sessions conducted using this system.
                  </NP>
               </section>

               <section>
                  <NH2>10. Changes to this Policy</NH2>

                  <NP>
                     This policy may be updated if system features or platform
                     operations change. Updated versions will be made available
                     to users before future assessment sessions.
                  </NP>
               </section>
            </NSpace>
         </NScrollbar>
      </NLayoutContent>
   </NLayout>
</template>

<script setup lang="ts">
import {
   NLayout,
   NLayoutContent,
   NSpace,
   NP,
   NH1,
   NH2,
   NH3,
   NText,
   NUl,
   NLi,
   NScrollbar,
   NDivider,
} from "naive-ui";
import { RouterLink } from "vue-router";
</script>

<style scoped>
section {
   margin-bottom: 24px;
}
</style>
