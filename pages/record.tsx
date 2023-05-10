import { useState } from 'react';
import { invoke } from "@tauri-apps/api/tauri"
import Link from 'next/link'

import styles from '../styles/Category.module.css'

interface Timestamp {
    timestamp: integer;
    readable: string;
}

interface AcsRecord {
    nhs_number: integer;
    age_at_index: integer;
    date_of_index: Timestamp;
    presentation: string;
}

export default function Home() {

    let [acs_records, setAcsRecords] = useState<AcsRecord[]>([]);

    // Function to load the codes yaml file
    function load_file() {
        invoke('get_yaml')
	    .then((result) => {

		// From rust
		let acs_records: AcsRecord[] = JSON.parse(result as string);
		setAcsRecords(acs_records);
		console.log(result);
	    })
    }

    if (acs_records.length == 0) {
	return <div>
            <h1>Patient ACS/PCI Record Viewer</h1>
	    <p className={styles.info}>Load a records file.</p>
	    <div>
		<span className={styles.button}
		      onClick={load_file}>Load file</span>
		<Link className={styles.button} href="/">Back</Link>
	    </div>
	</div>
    } else {
	return <div> {
	    acs_records.map(record => <div>
		<div>
		    NHS number: {record.nhs_number}
		</div><div>
		    Age at index: {record.age_at_index}
		</div><div>
		    Date of index: {record.date_of_index.readable}
		</div>
	    </div>)
	} </div>

    }
}
