import { useState } from 'react';
import { invoke } from "@tauri-apps/api/tauri"
import Link from 'next/link'

import styles from '../styles/Category.module.css'

export default function Home() {

    let [patient_records, setPatientRecords] = useState<TopLevelCategory>({categories: [], groups: []});

    // Function to load the codes yaml file
    function load_file() {
        invoke('get_yaml')
	    .then((result) => {

		// From rust
		//let patient_records: PatientRecord[] = JSON.parse(result as string);
		console.log(result)
	    })
    }

    return <div>
        <h1>Patient ACS/PCI Record Viewer</h1>
	<p className={styles.info}>Load a records file.</p>
	<div>
	    <span className={styles.button}
		  onClick={load_file}>Load file</span>
	    <Link className={styles.button} href="/">Back</Link>
	</div>
    </div>
}
